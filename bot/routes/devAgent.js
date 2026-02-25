import { Router } from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import authenticate from '../middleware/auth.js';
import User from '../models/User.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const MAX_CONTEXT_FILES = 5;
const MAX_SCAN_FILES = 180;
const MAX_FILE_CHARS = 3800;
const SEARCH_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.md',
  '.mjs',
  '.cjs',
  '.css',
  '.yml',
  '.yaml'
]);

const ALLOWED_ROOTS = [
  'bot',
  'webapp/src',
  'packages',
  'docs',
  'README.md',
  'README-platform-help-agent.md'
];

const IGNORED_FILE_PATTERNS = [
  /package-lock\.json$/i,
  /pnpm-lock\.yaml$/i,
  /yarn\.lock$/i,
  /dist\//i,
  /build\//i,
  /\.min\./i,
  /coverage\//i,
  /webapp\/src\/assets\//i
];

const QUICK_ACTIONS = {
  explain: 'Explain this module and key flows',
  find_bug: 'Find likely bug or risky logic path and propose a patch plan',
  api_map: 'Map endpoint flow request -> route -> model/service and list touched files',
  ui_plan: 'Give a concrete mobile-first UI implementation plan'
};

let openAIClient = null;
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!openAIClient) openAIClient = new OpenAI({ apiKey });
  return openAIClient;
}

function getDevAccounts() {
  return [
    process.env.DEV_ACCOUNT_ID,
    process.env.VITE_DEV_ACCOUNT_ID,
    process.env.DEV_ACCOUNT_ID_1,
    process.env.VITE_DEV_ACCOUNT_ID_1,
    process.env.DEV_ACCOUNT_ID_2,
    process.env.VITE_DEV_ACCOUNT_ID_2
  ].filter(Boolean);
}

async function resolveAccountId(req) {
  if (req.auth?.accountId) return req.auth.accountId;
  if (req.auth?.telegramId) {
    const user = await User.findOne({ telegramId: req.auth.telegramId }).select('accountId');
    return user?.accountId || null;
  }
  if (req.auth?.googleId) {
    const user = await User.findOne({ googleId: req.auth.googleId }).select('accountId');
    return user?.accountId || null;
  }
  return null;
}

function normalizePath(absolutePath) {
  return absolutePath.replace(/\\/g, '/');
}

function isIgnoredFile(absolutePath) {
  const normalized = normalizePath(absolutePath);
  return IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isAllowedPath(absolutePath) {
  const normalized = normalizePath(absolutePath);
  return ALLOWED_ROOTS.some((root) => {
    const fullRoot = normalizePath(path.resolve(repoRoot, root));
    return normalized === fullRoot || normalized.startsWith(`${fullRoot}/`);
  });
}

async function collectFiles(dir, found = []) {
  if (found.length >= MAX_SCAN_FILES) return found;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (!isAllowedPath(fullPath)) continue;

    if (entry.isDirectory()) {
      await collectFiles(fullPath, found);
    } else if (SEARCH_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && !isIgnoredFile(fullPath)) {
      found.push(fullPath);
    }
    if (found.length >= MAX_SCAN_FILES) break;
  }
  return found;
}


function extractExplicitPaths(message) {
  const raw = String(message || '');
  const matches = raw.match(/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_./-]+\.(?:jsx|tsx|ts|js|json|md|css)/g) || [];
  return [...new Set(matches.map((m) => normalizePath(m)))];
}

function extractQueryTerms(message) {
  return String(message || '')
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((term) => term.length >= 3)
    .slice(0, 14);
}

function scoreFile(content, terms, message, filePath) {
  const lower = content.toLowerCase();
  const lowerPath = String(filePath || '').toLowerCase();
  let score = 0;
  for (const term of terms) {
    const hits = lower.split(term).length - 1;
    score += hits;
    if (lowerPath.includes(term)) score += 4;
  }
  if (message && lower.includes(String(message).toLowerCase())) score += 6;
  if (/export\s+default|router\.|app\.use|function\s+|const\s+/.test(content)) score += 2;
  if (/dev.?agent/.test(lowerPath) && /dev|agent/.test(String(message || '').toLowerCase())) score += 12;
  return score;
}

function makeExcerpt(content, terms) {
  const lower = content.toLowerCase();
  const firstHit = terms
    .map((term) => lower.indexOf(term))
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b)[0];

  if (firstHit == null) {
    return content.slice(0, MAX_FILE_CHARS);
  }

  const start = Math.max(0, firstHit - 700);
  return content.slice(start, start + MAX_FILE_CHARS);
}

async function buildContext(message) {
  const terms = extractQueryTerms(message);
  const explicitPaths = extractExplicitPaths(message);
  if (!terms.length && !explicitPaths.length) return [];

  const files = new Set();
  for (const explicitPath of explicitPaths) {
    const abs = path.resolve(repoRoot, explicitPath);
    if (isAllowedPath(abs) && !isIgnoredFile(abs)) files.add(abs);
  }

  if (files.size) {
    const directMatches = [];
    for (const file of Array.from(files)) {
      try {
        const content = await fs.readFile(file, 'utf8');
        directMatches.push({
          file: normalizePath(path.relative(repoRoot, file)),
          excerpt: content.slice(0, MAX_FILE_CHARS),
          score: 999
        });
      } catch {
        // ignore invalid explicit path
      }
    }
    if (directMatches.length) return directMatches.slice(0, MAX_CONTEXT_FILES);
  }
  for (const root of ALLOWED_ROOTS) {
    const rootPath = path.resolve(repoRoot, root);
    try {
      const stat = await fs.stat(rootPath);
      if (stat.isFile()) {
        if (!isIgnoredFile(rootPath)) files.add(rootPath);
      } else {
        const collected = [];
        await collectFiles(rootPath, collected);
        collected.forEach((f) => files.add(f));
      }
    } catch {
      // ignore
    }
  }

  const scored = [];
  for (const file of Array.from(files)) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const relativePath = normalizePath(path.relative(repoRoot, file));
      let score = scoreFile(content, terms, message, file);
      if (explicitPaths.some((p) => relativePath.endsWith(p) || relativePath === p)) score += 120;
      if (score > 0) {
        scored.push({
          file,
          score,
          excerpt: makeExcerpt(content, terms)
        });
      }
    } catch {
      // ignore unreadable
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_CONTEXT_FILES).map((entry) => ({
    file: normalizePath(path.relative(repoRoot, entry.file)),
    excerpt: entry.excerpt,
    score: entry.score
  }));
}

function buildPrompt({ message, context, quickAction }) {
  const contextBlock = context
    .map(
      (item, idx) =>
        `[#${idx + 1}] ${item.file}\nscore=${item.score}\n${item.excerpt}`
    )
    .join('\n\n');

  return [
    'You are TonPlaygram Dev Agent, a senior full-stack coding assistant.',
    'Goals: practical implementation, mobile-first UX, secure defaults, concise but actionable answers.',
    'Rules: never fabricate files; use only provided context; if missing context, state exactly what file is needed.',
    'Format: 1) Diagnosis 2) Action steps 3) Minimal code sketch (if useful) 4) Risks/checks.',
    quickAction ? `Requested quick action: ${quickAction}` : '',
    '',
    `Developer message: ${message}`,
    '',
    'Repository context:',
    contextBlock || 'No matching files found.'
  ]
    .filter(Boolean)
    .join('\n');
}

async function completeWithOpenAI({ message, context, quickAction }) {
  const client = getOpenAIClient();
  if (!client) return null;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content: buildPrompt({ message, context, quickAction })
      }
    ]
  });

  return completion.choices?.[0]?.message?.content?.trim() || null;
}

function buildSmartFallback({ message, context, quickAction }) {
  const first = context[0];
  const topFiles = context.map((item) => `- ${item.file}`).join('\n');

  const intro = quickAction
    ? `Quick action executed locally: ${quickAction}.`
    : 'GPT is unavailable, so this is a local smart analysis.';

  const guidance = !first
    ? 'I could not find strong file matches. Mention a route/component/file name for better targeting.'
    : [
      `Best match: ${first.file}.`,
      'Recommended next steps:',
      '1) Open the top matched file and verify entry points (exports, route handlers, effects).',
      '2) Trace its direct imports and update exactly one layer at a time (UI -> API helper -> route).',
      '3) Re-run build and smoke-test the affected screen on mobile portrait.',
      '4) If needed, ask me with a file path (example: "explain webapp/src/pages/MyAccount.jsx").'
    ].join('\n');

  return [
    intro,
    `Question: ${String(message || '').slice(0, 500)}`,
    guidance,
    context.length ? 'Top matched files:\n' + topFiles : 'Top matched files: none',
    'To unlock full GPT answers in this route, set OPENAI_API_KEY (same backend env used by /ask command).'
  ].join('\n\n');
}

async function requireDev(req, res) {
  const accountId = await resolveAccountId(req);
  const devAccounts = getDevAccounts();
  if (!accountId || (devAccounts.length && !devAccounts.includes(accountId))) {
    res.status(403).json({ error: 'forbidden' });
    return null;
  }
  return { accountId, hasGpt: Boolean(getOpenAIClient()) };
}

router.get('/status', authenticate, async (req, res) => {
  try {
    const dev = await requireDev(req, res);
    if (!dev) return;
    return res.json({
      ok: true,
      gptConnected: dev.hasGpt,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      quickActions: QUICK_ACTIONS
    });
  } catch (err) {
    console.error('[dev-agent] status failed:', err);
    return res.status(500).json({ error: 'status failed' });
  }
});

router.post('/chat', authenticate, async (req, res) => {
  try {
    const dev = await requireDev(req, res);
    if (!dev) return;

    const message = String(req.body?.message || '').trim();
    const quickActionKey = String(req.body?.quickAction || '').trim();
    const quickAction = QUICK_ACTIONS[quickActionKey] || '';

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const context = await buildContext(message);

    let answer = null;
    let mode = 'fallback';
    try {
      answer = await completeWithOpenAI({ message, context, quickAction });
      if (answer) mode = 'gpt';
    } catch (err) {
      console.error('[dev-agent] gpt failed, fallback:', err?.message || err);
    }

    if (!answer) {
      answer = buildSmartFallback({ message, context, quickAction });
    }

    return res.json({
      answer,
      citations: context.map((item) => item.file),
      mode,
      gptConnected: dev.hasGpt,
      quickActions: QUICK_ACTIONS
    });
  } catch (err) {
    console.error('[dev-agent] request failed:', err);
    return res.status(500).json({ error: 'dev agent request failed' });
  }
});

export default router;
