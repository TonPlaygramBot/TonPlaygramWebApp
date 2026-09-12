import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEBAPP_DIR = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_DIST_DIR = path.join(WEBAPP_DIR, 'dist');
const REPORT_PATH = 'pwa/game-packs/native-prune-report.json';

const within = (parent, candidate) => {
  const relative = path.relative(parent, candidate);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const localPathForUrl = (distDir, url) => {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return null;
  const decoded = decodeURIComponent(url.split(/[?#]/, 1)[0]);
  const candidate = path.resolve(distDir, decoded.replace(/^\/+/, ''));
  return within(distDir, candidate) ? candidate : null;
};

async function removeEmptyParents(startDirectory, stopDirectory) {
  let current = startDirectory;
  while (within(stopDirectory, current)) {
    const entries = await readdir(current).catch(() => null);
    if (!entries || entries.length) return;
    await rm(current, { recursive: false, force: true });
    current = path.dirname(current);
  }
}

export async function pruneNativeGamePacks({ distDir = DEFAULT_DIST_DIR } = {}) {
  const catalogPath = path.join(distDir, 'pwa', 'game-packs', 'index.json');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  if (catalog.source !== 'cdn' && process.env.ALLOW_SAME_ORIGIN_GAME_PACK_PRUNE !== '1') {
    throw new Error(
      'Refusing to prune native game assets without GAME_PACK_CDN_BASE_URL. ' +
      'Build manifests must point to an external HTTPS content origin.'
    );
  }

  const preservedUrls = new Set(
    (catalog.packs || [])
      .map(pack => pack.cover)
      .filter(value => typeof value === 'string' && value.startsWith('/'))
  );
  const seenUrls = new Set();
  let removedFiles = 0;
  let removedBytes = 0;

  for (const pack of catalog.packs || []) {
    const manifestPath = path.join(distDir, String(pack.manifestUrl || '').replace(/^\/+/, ''));
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    for (const asset of manifest.assets || []) {
      if (!asset?.url || asset.nativeRemovable === false || seenUrls.has(asset.url) || preservedUrls.has(asset.url)) continue;
      seenUrls.add(asset.url);
      if (!/^https:\/\//i.test(String(asset.sourceUrl || '')) && catalog.source === 'cdn') {
        throw new Error(`Pack asset is missing an HTTPS CDN source: ${asset.url}`);
      }
      const filePath = localPathForUrl(distDir, asset.url);
      if (!filePath) continue;
      const info = await stat(filePath).catch(() => null);
      if (!info?.isFile()) continue;
      removedBytes += info.size;
      removedFiles += 1;
      await rm(filePath, { force: true });
      await removeEmptyParents(path.dirname(filePath), distDir);
    }
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    catalogSource: catalog.source,
    removedFiles,
    removedBytes,
    preservedCovers: [...preservedUrls].sort()
  };
  const reportFile = path.join(distDir, REPORT_PATH);
  await mkdir(path.dirname(reportFile), { recursive: true });
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main() {
  const report = await pruneNativeGamePacks();
  console.log(
    `Pruned ${report.removedFiles.toLocaleString()} native game-pack files ` +
    `(${report.removedBytes.toLocaleString()} bytes); covers and manifests remain bundled.`
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
