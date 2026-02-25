import { Router } from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import authenticate from '../middleware/auth.js';
import User from '../models/User.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const MAX_CONTEXT_FILES = 4;
const MAX_FILE_CHARS = 2800;
const SEARCH_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.mjs', '.cjs', '.css'
]);
const ALLOWED_ROOTS = ['bot', 'webapp/src', 'packages', 'docs', 'README.md', 'README-platform-help-agent.md'];

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

function isAllowedPath(absolutePath) {
  const normalized = absolutePath.replace(/\\/g, '/');
  return ALLOWED_ROOTS.some((root) => {
    const fullRoot = path.resolve(repoRoot, root).replace(/\\/g, '/');
    return normalized === fullRoot || normalized.startsWith(`${fullRoot}/`);
  });
}

async function collectFiles(dir, found = []) {
  if (found.length >= 120) return found;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (!isAllowedPath(fullPath)) continue;
    if (entry.isDirectory()) {
      await collectFiles(fullPath, found);
    } else if (SEARCH_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      found.push(fullPath);
    }
    if (found.length >= 120) break;
  }
  return found;
}

function scoreFile(content, terms) {
  const lower = content.toLowerCase();
  return terms.reduce((acc, t) => acc + (lower.includes(t) ? 1 : 0), 0);
}

async function buildContext(message) {
  const terms = String(message || '')
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((term) => term.length >= 3)
    .slice(0, 10);

  if (!terms.length) return [];

  const files = [];
  for (const root of ALLOWED_ROOTS) {
    const rootPath = path.resolve(repoRoot, root);
    try {
      const stat = await fs.stat(rootPath);
      if (stat.isFile()) {
        files.push(rootPath);
      } else {
        await collectFiles(rootPath, files);
      }
    } catch {
      // ignore missing root
    }
  }

  const scored = [];
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const score = scoreFile(content, terms);
      if (score > 0) {
        scored.push({ file, score, content: content.slice(0, MAX_FILE_CHARS) });
      }
    } catch {
      // ignore unreadable files
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_CONTEXT_FILES).map((entry) => ({
    file: path.relative(repoRoot, entry.file).replace(/\\/g, '/'),
    excerpt: entry.content
  }));
}

async function completeWithOpenAI({ message, context }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const contextBlock = context
    .map((item, idx) => `[#${idx + 1}] ${item.file}\n${item.excerpt}`)
    .join('\n\n');

  const prompt = [
    'You are a dev-only coding assistant for TonPlaygram.',
    'Use the provided code snippets only. If unsure, say what is missing.',
    'Keep answers concise and implementation-focused.',
    '',
    `Developer question: ${message}`,
    '',
    'Relevant code context:',
    contextBlock || 'No file context found.'
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const failText = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed (${response.status}): ${failText.slice(0, 160)}`);
  }

  const payload = await response.json();
  return payload?.choices?.[0]?.message?.content?.trim() || null;
}

function fallbackAnswer(message, context) {
  const lines = [
    'Dev Agent quick response (fallback mode).',
    `Question: ${String(message || '').slice(0, 400)}`
  ];

  if (!context.length) {
    lines.push('No relevant files matched. Try mentioning file/module names.');
    return lines.join('\n');
  }

  lines.push('Matched files (fast context):');
  context.forEach((item) => lines.push(`- ${item.file}`));
  lines.push('Set OPENAI_API_KEY on server to enable full GPT answers.');
  return lines.join('\n');
}

router.post('/chat', authenticate, async (req, res) => {
  try {
    const accountId = await resolveAccountId(req);
    const devAccounts = getDevAccounts();
    if (!accountId || (devAccounts.length && !devAccounts.includes(accountId))) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const context = await buildContext(message);
    let answer = null;
    try {
      answer = await completeWithOpenAI({ message, context });
    } catch (err) {
      console.error('[dev-agent] LLM failed, using fallback:', err?.message || err);
    }

    if (!answer) {
      answer = fallbackAnswer(message, context);
    }

    return res.json({
      answer,
      citations: context.map((item) => item.file),
      mode: process.env.OPENAI_API_KEY ? 'gpt' : 'fallback'
    });
  } catch (err) {
    console.error('[dev-agent] request failed:', err);
    return res.status(500).json({ error: 'dev agent request failed' });
  }
});

export default router;
