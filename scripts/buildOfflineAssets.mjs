import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'webapp', 'public');
const offlineManifestPath = path.join(publicDir, 'pwa', 'offline-assets.json');

const BASE_ENTRIES = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/tonconnect-manifest.json',
  '/service-worker.js'
];

const EXCLUDED_FILENAMES = new Set(['tonplaygram-launcher.apk']);
const ALLOWED_EXTENSIONS = new Set([
  '.bin',
  '.css',
  '.dds',
  '.gif',
  '.glb',
  '.gltf',
  '.hdr',
  '.html',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.ktx2',
  '.m4a',
  '.mp3',
  '.ogg',
  '.otf',
  '.png',
  '.stl',
  '.svg',
  '.ttf',
  '.txt',
  '.wav',
  '.webmanifest',
  '.webp',
  '.woff',
  '.woff2'
]);

async function collectFiles(currentDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(currentDir, entry.name);
    const relative = path.relative(publicDir, absolute).split(path.sep).join('/');

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolute)));
      continue;
    }

    if (EXCLUDED_FILENAMES.has(entry.name)) continue;

    const extension = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) continue;

    files.push(`/${relative}`);
  }

  return files;
}

async function buildOfflineManifest() {
  const discovered = await collectFiles(publicDir);
  const unique = Array.from(new Set([...BASE_ENTRIES, ...discovered])).sort();

  await fs.writeFile(offlineManifestPath, `${JSON.stringify(unique, null, 2)}\n`);
  console.log(`Generated ${offlineManifestPath} with ${unique.length} entries.`);
}

buildOfflineManifest().catch(err => {
  console.error('Failed to build offline manifest', err);
  process.exitCode = 1;
});
