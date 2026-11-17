import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_MAX_BYTES = 200 * 1024 * 1024;
const defaultDist = fileURLToPath(new URL('../dist/', import.meta.url));

export function readBudget(env = process.env) {
  const raw = env.NATIVE_BUNDLE_MAX_BYTES;
  if (raw === undefined) return { maxBytes: DEFAULT_MAX_BYTES, reason: null };
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new Error('NATIVE_BUNDLE_MAX_BYTES must be a positive safe integer in bytes.');
  }
  const reason = (env.NATIVE_BUNDLE_SIZE_OVERRIDE_REASON || '').trim();
  if (Number(raw) > DEFAULT_MAX_BYTES && reason.length < 12) {
    throw new Error('Raising the native size budget requires NATIVE_BUNDLE_SIZE_OVERRIDE_REASON (at least 12 characters).');
  }
  return { maxBytes: Number(raw), reason: reason || null };
}

export async function measureBundle(distDir = defaultDist) {
  const root = await fs.lstat(distDir);
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error('Native dist must be a real directory.');
  const index = await fs.lstat(path.join(distDir, 'index.html'));
  if (!index.isFile() || index.isSymbolicLink() || index.size === 0) throw new Error('Native dist requires a nonempty regular index.html.');
  const files = [];
  async function walk(dir) {
    for (const name of await fs.readdir(dir)) {
      const absolute = path.join(dir, name);
      const stat = await fs.lstat(absolute);
      const relative = path.relative(distDir, absolute).split(path.sep).join('/');
      if (stat.isSymbolicLink()) throw new Error(`Cannot safely size a symlink: ${relative}`);
      if (stat.isDirectory()) await walk(absolute);
      else if (stat.isFile()) files.push({ path: relative, bytes: stat.size });
      else throw new Error(`Unsupported native asset type: ${relative}`);
    }
  }
  await walk(distDir);
  files.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
  const groups = Object.create(null);
  for (const file of files) {
    const group = file.path.split('/').slice(0, 2).join('/');
    groups[group] = (groups[group] || 0) + file.bytes;
  }
  return {
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    fileCount: files.length,
    largestFiles: files.slice(0, 20),
    largestGroups: Object.entries(groups).map(([path, bytes]) => ({ path, bytes })).sort((a, b) => b.bytes - a.bytes).slice(0, 20)
  };
}

export async function checkBundle({ distDir = defaultDist, env = process.env } = {}) {
  const budget = readBudget(env);
  const measured = await measureBundle(distDir);
  return { ...measured, ...budget, passed: measured.totalBytes <= budget.maxBytes,
    measurement: 'Uncompressed webDir bytes, not APK/AAB/IPA size or store eligibility' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw new Error('No arguments supported; checks webapp/dist only.');
    const report = await checkBundle();
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) {
      console.error(`Native bundle blocked: ${report.totalBytes} bytes exceeds ${report.maxBytes}. See docs/native-bundle-size.md. No files changed.`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`Native bundle preflight failed: ${error.message}`);
    process.exitCode = 1;
  }
}
