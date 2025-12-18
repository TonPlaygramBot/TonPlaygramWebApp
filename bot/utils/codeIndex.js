import fg from 'fast-glob';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const CODE_GLOBS = [
  'webapp/src/**/*.{js,jsx,ts,tsx,css,scss,md,json,html}',
  'webapp/public/**/*.{js,json,md,html,css}',
  'bot/**/*.{js,json,md}',
  'docs/**/*.{md,yml,yaml,json}',
  'examples/**/*.{js,ts,tsx,md,json}',
  'scripts/**/*.{js,ts,md}',
  'render.yaml',
  '*.md'
];

const IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.cache/**',
  '**/.turbo/**',
  '**/.idea/**',
  '**/.vscode/**',
  '**/dist/**',
  '**/build/**',
  'webapp/.vite/**',
  'webapp/coverage/**',
  'webapp/public/assets/**',
  'billiards.Unity/**',
  'billiards.Tests/**',
  'billiards/**/Library/**',
  '**/*.log'
];

const MAX_FILE_BYTES = 160_000;
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

let indexCache = null;
let chunkCache = null;

function chunkContent(content = '') {
  const chunks = [];
  let start = 0;
  const len = content.length;
  while (start < len) {
    const end = Math.min(len, start + CHUNK_SIZE);
    chunks.push(content.slice(start, end));
    if (end >= len) break;
    const nextStart = Math.max(0, end - CHUNK_OVERLAP);
    if (nextStart <= start) break;
    start = nextStart;
  }
  return chunks;
}

function buildIndex() {
  if (indexCache) return indexCache;
  const entries = fg.sync(CODE_GLOBS, {
    cwd: repoRoot,
    ignore: IGNORE,
    dot: false
  });
  indexCache = entries
    .map((relPath) => {
      const full = path.join(repoRoot, relPath);
      try {
        const stats = fs.statSync(full);
        if (!stats.isFile()) return null;
        if (stats.size === 0 || stats.size > MAX_FILE_BYTES) return null;
        const content = fs.readFileSync(full, 'utf8');
        return {
          path: relPath.replace(/\\/g, '/'),
          size: stats.size,
          content
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return indexCache;
}

function buildChunks() {
  if (chunkCache) return chunkCache;
  const files = buildIndex();
  chunkCache = files.flatMap((file) => {
    const parts = chunkContent(file.content);
    return parts.map((text, idx) => ({
      path: file.path,
      key: `${file.path}#${idx}`,
      content: text,
      lower: text.toLowerCase()
    }));
  });
  return chunkCache;
}

function tokenize(query = '') {
  return query
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((t) => t && t.length > 2 && !['this', 'that', 'with', 'from'].includes(t));
}

export function findRelevantChunks(query, { maxChunks = 10, maxChars = 9000 } = {}) {
  const terms = tokenize(query);
  const chunks = buildChunks();
  const scored = chunks
    .map((chunk) => {
      let score = 0;
      for (const term of terms) {
        if (chunk.lower.includes(term)) score += 2;
        if (chunk.path.toLowerCase().includes(term)) score += 3;
      }
      return { ...chunk, score };
    })
    .sort((a, b) => b.score - a.score || b.content.length - a.content.length);

  const result = [];
  let totalChars = 0;
  for (const chunk of scored) {
    if (result.length >= maxChunks) break;
    if (totalChars + chunk.content.length > maxChars && result.length > 0) break;
    result.push({ path: chunk.path, content: chunk.content, score: chunk.score });
    totalChars += chunk.content.length;
  }
  if (result.length === 0 && scored.length > 0) {
    result.push({ path: scored[0].path, content: scored[0].content.slice(0, maxChars), score: scored[0].score });
  }
  return result;
}

export function getIndexStats() {
  const files = buildIndex();
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  return {
    files: files.length,
    totalBytes,
  };
}

export function resetIndexCache() {
  indexCache = null;
  chunkCache = null;
}
