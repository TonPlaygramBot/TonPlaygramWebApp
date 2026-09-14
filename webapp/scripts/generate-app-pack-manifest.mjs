import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const APP_PACK_ID = 'tonplaygram-app';
const DEFAULT_DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url));
const PACK_DIRECTORY = 'pwa/game-packs';
const EXTERNAL_DIRECTORY = 'assets/external';
const CONTROL_FILES = new Set([
  'service-worker.js',
  'pwa/app-build.js',
  'pwa/game-pack-service-worker.js',
  'version.json',
  '_redirects',
  '_headers'
]);

// Use the actual build output, rather than an extension list or an asset-root
// list: games also load nested decoder scripts, fonts, audio and sidecar files.
// Update metadata must stay network-readable and pack manifests cannot include
// themselves. Source maps and hosting instructions are not application assets.
const isApplicationFile = relative =>
  !CONTROL_FILES.has(relative) &&
  !relative.startsWith(`${PACK_DIRECTORY}/`) &&
  !relative.split('/').some(segment => segment.startsWith('.')) &&
  !relative.toLowerCase().endsWith('.map');

async function collectFiles(directory, root = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (!isApplicationFile(relative)) continue;
    if (entry.isDirectory()) files.push(...await collectFiles(absolute, root));
    else if (entry.isFile()) files.push(relative);
    else if (entry.isSymbolicLink()) {
      throw new Error(`Cannot include a symbolic link in the application download: ${relative}`);
    }
  }
  return files.sort();
}

const assetUrl = relative => `/${relative.split('/').map(encodeURIComponent).join('/')}`;

async function hashFile(filename) {
  const digest = createHash('sha256');
  let size = 0;
  for await (const chunk of createReadStream(filename)) {
    digest.update(chunk);
    size += chunk.byteLength;
  }
  return { size, sha256: digest.digest('hex') };
}

async function readLegacySources(distDir, packs) {
  const sources = new Map();
  for (const pack of packs) {
    if (pack.id === APP_PACK_ID) continue;
    const manifestRelative = String(pack.manifestUrl || '').replace(/^\//, '');
    if (!manifestRelative.startsWith(`${PACK_DIRECTORY}/`) || manifestRelative.split('/').includes('..')) {
      throw new Error(`Invalid built game manifest path for ${pack.id}.`);
    }
    const manifest = JSON.parse(await readFile(path.join(distDir, manifestRelative), 'utf8'));
    for (const asset of manifest.assets || []) {
      // Native-lite builds still prune files using the legacy manifests. Keep
      // their configured CDN sources so the complete app can restore them too.
      if (typeof asset.url === 'string' && /^https:\/\//i.test(asset.sourceUrl || '')) {
        const key = new URL(asset.url, 'https://tonplaygram.invalid').pathname;
        sources.set(key, asset.sourceUrl);
      }
    }
  }
  return sources;
}

async function verifyBuiltShell(distDir, files) {
  if (!files.includes('index.html')) throw new Error('The application build is missing index.html.');
  if (!files.some(file => /^assets\/.+\.(?:m?js)$/i.test(file))) {
    throw new Error('The application build is missing executable runtime chunks.');
  }
  const html = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const moduleScripts = [...html.matchAll(/<script\b[^>]*>/gi)]
    .map(match => match[0])
    .filter(tag => /\btype\s*=\s*["']module["']/i.test(tag))
    .map(tag => tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1])
    .filter(Boolean);
  if (!moduleScripts.length) throw new Error('The application shell has no built module entry.');
  for (const src of moduleScripts) {
    const url = new URL(src, 'https://tonplaygram.invalid/');
    const relative = decodeURIComponent(url.pathname).replace(/^\//, '');
    if (url.origin !== 'https://tonplaygram.invalid' || !files.includes(relative)) {
      throw new Error(`The application shell references an unavailable runtime: ${src}`);
    }
  }
  return html;
}

const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const sortedRecord = value => Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));

async function readExternalAssetRequirements(distDir, files, html) {
  const requiresExternalAssets = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)]
    .some(match => new URL(match[1], 'https://tonplaygram.invalid/').pathname === `/${EXTERNAL_DIRECTORY}/url-map.js`);
  if (!requiresExternalAssets) return [];

  const requiredFiles = ['manifest.json', 'url-map.json', 'url-map.js'];
  for (const file of requiredFiles) {
    if (!files.includes(`${EXTERNAL_DIRECTORY}/${file}`)) {
      throw new Error(`The complete application download requires ${EXTERNAL_DIRECTORY}/${file}. Finish importing external game assets before building.`);
    }
  }
  const [manifestText, mapText, mapScript] = await Promise.all(requiredFiles.map(file => readFile(path.join(distDir, EXTERNAL_DIRECTORY, file), 'utf8')));
  const manifest = JSON.parse(manifestText);
  if (manifest.schemaVersion !== 1 || manifest.complete !== true || !Array.isArray(manifest.assets) || !manifest.assets.length ||
      !Array.isArray(manifest.failures) || !Array.isArray(manifest.groups) || !isRecord(manifest.urlMap)) {
    throw new Error('The external game asset import is incomplete or its manifest is invalid. A complete application download cannot be published.');
  }
  const failures = manifest.failures.filter(failure => failure?.essential !== false);
  if (failures.length) {
    throw new Error(`The external game asset import has ${failures.length} unresolved required asset(s): ${failures.slice(0, 3).map(failure => failure?.id || failure?.sourceUrl || 'unknown asset').join(', ')}`);
  }
  const mapping = JSON.parse(mapText);
  const assignment = mapScript.replace(/^\s*\/\*[\s\S]*?\*\//, '').trim()
    .match(/^self\.__TONPLAYGRAM_EXTERNAL_ASSETS__\s*=\s*(\{[\s\S]*\})\s*;?$/);
  const scriptMapping = assignment ? JSON.parse(assignment[1]) : null;
  const canonical = JSON.stringify(sortedRecord(manifest.urlMap));
  if (!isRecord(mapping) || !isRecord(scriptMapping) || JSON.stringify(sortedRecord(mapping)) !== canonical ||
      JSON.stringify(sortedRecord(scriptMapping)) !== canonical) {
    throw new Error('The external game asset runtime mappings differ from the completed import manifest.');
  }

  const fileSet = new Set(files);
  const canonicalLocalUrl = localUrl => {
    if (typeof localUrl !== 'string' || !localUrl.startsWith('/assets/')) throw new Error(`External asset mapping is not a bundled asset: ${localUrl}`);
    const parsed = new URL(localUrl, 'https://tonplaygram.invalid/');
    const relative = decodeURIComponent(parsed.pathname).replace(/^\//, '');
    if (parsed.origin !== 'https://tonplaygram.invalid' || parsed.search || parsed.hash || !relative.startsWith('assets/') || !fileSet.has(relative)) {
      throw new Error(`External asset mapping target is missing from the application build: ${localUrl}`);
    }
    return assetUrl(relative);
  };
  for (const target of Object.values(mapping)) canonicalLocalUrl(target);
  for (const group of manifest.groups) {
    if (group.essential !== false && !mapping[group.sourceUrl]) throw new Error(`Required external asset group is missing from the runtime mapping: ${group.id}`);
  }
  return manifest.assets.map(entry => {
    if (!isRecord(entry) || !Number.isInteger(entry.size) || entry.size < 0 || !/^[a-f0-9]{64}$/i.test(entry.sha256 || '') || mapping[entry.sourceUrl] !== entry.url) {
      throw new Error(`Invalid external asset import record: ${entry?.sourceUrl || 'unknown asset'}`);
    }
    for (const alias of entry.aliases || []) {
      if (mapping[alias] !== entry.url) throw new Error(`External asset alias is missing from the runtime mapping: ${alias}`);
    }
    for (const dependency of entry.dependencies || []) {
      if (!mapping[dependency.url]) throw new Error(`External asset dependency is missing from the runtime mapping: ${dependency.url}`);
    }
    return { url: canonicalLocalUrl(entry.url), size: entry.size, sha256: entry.sha256.toLowerCase() };
  });
}

export async function generateBuiltAppPack(distDir = DEFAULT_DIST_DIR) {
  const catalogPath = path.join(distDir, PACK_DIRECTORY, 'index.json');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  if (!Array.isArray(catalog.packs)) throw new Error('The built game-pack catalog is invalid.');
  const metadata = JSON.parse(await readFile(path.join(distDir, 'version.json'), 'utf8'));
  if (typeof metadata.build !== 'string' || !metadata.build.trim()) {
    throw new Error('The application build is missing its build identifier.');
  }

  const files = await collectFiles(distDir);
  const html = await verifyBuiltShell(distDir, files);
  const externalRequirements = await readExternalAssetRequirements(distDir, files, html);
  const sources = await readLegacySources(distDir, catalog.packs);
  const assets = [];
  for (const relative of files) {
    const url = assetUrl(relative);
    assets.push({
      url,
      sourceUrl: sources.get(url) || url,
      ...await hashFile(path.join(distDir, relative)),
      nativeRemovable: false
    });
  }
  // Reuse the streamed build hashes: large model/environment libraries must not
  // be loaded into memory or hashed twice just to verify importer completeness.
  const assetsByUrl = new Map(assets.map(asset => [asset.url, asset]));
  for (const expected of externalRequirements) {
    const actual = assetsByUrl.get(expected.url);
    if (!actual || actual.size !== expected.size || actual.sha256 !== expected.sha256) {
      throw new Error(`Imported external asset checksum/size differs from the completed import: ${expected.url}`);
    }
  }
  const digest = createHash('sha256');
  for (const asset of assets) digest.update(`${asset.url}\0${asset.size}\0${asset.sha256}\n`);
  const version = digest.digest('hex').slice(0, 16);
  const manifest = {
    schemaVersion: 1,
    id: APP_PACK_ID,
    build: metadata.build,
    version,
    dependencies: [],
    totalBytes: assets.reduce((total, asset) => total + asset.size, 0),
    assetCount: assets.length,
    assets
  };
  const legacyPacks = catalog.packs.filter(pack => pack.id !== APP_PACK_ID);
  const appPack = {
    id: APP_PACK_ID,
    title: 'TonPlayGram',
    description: 'The complete application and all bundled game files for faster loading on this device.',
    hidden: false,
    route: '/',
    gameSlugs: [...new Set(legacyPacks.flatMap(pack => pack.gameSlugs || []))].sort(),
    dependencies: [],
    build: manifest.build,
    version,
    totalBytes: manifest.totalBytes,
    assetCount: manifest.assetCount,
    manifestUrl: `/${PACK_DIRECTORY}/${APP_PACK_ID}.json`
  };
  const nextCatalog = {
    ...catalog,
    schemaVersion: 1,
    build: manifest.build,
    generatedAt: new Date().toISOString(),
    packs: [appPack, ...legacyPacks.map(pack => ({ ...pack, hidden: true }))]
  };
  await writeFile(path.join(distDir, PACK_DIRECTORY, `${APP_PACK_ID}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(catalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`);
  return { manifest, catalog: nextCatalog };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  generateBuiltAppPack(process.argv[2] || DEFAULT_DIST_DIR).then(({ manifest }) => {
    console.log(`Generated complete TonPlayGram download: ${manifest.assetCount} files, ${manifest.totalBytes.toLocaleString()} bytes (${manifest.version}).`);
  }).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
