import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEBAPP_DIR = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_PUBLIC_DIR = path.join(WEBAPP_DIR, 'public');
const DEFAULT_OUTPUT_DIR = path.join(DEFAULT_PUBLIC_DIR, 'pwa', 'game-packs');
const SCHEMA_VERSION = 1;

const PACKABLE_EXTENSIONS = new Set([
  '.basis', '.bin', '.dds', '.exr', '.glb', '.gltf', '.hdr', '.json', '.ktx2', '.wasm'
]);

export const GAME_PACK_DEFINITIONS = Object.freeze([
  {
    id: 'shared-tirana-vehicles',
    title: 'Shared Tirana Vehicle Fleet',
    description: 'Vehicle models shared by Tirana Streets and Racing Royal.',
    hidden: true,
    cover: '/assets/kart-royale/cover.webp',
    route: null,
    gameSlugs: [],
    roots: ['assets/tirana-streets/vehicle-collection'],
    dependencies: []
  },
  {
    id: 'tirana-streets',
    title: 'Tirana Streets',
    description: 'City, landmark, street-life, vehicle and operation assets.',
    cover: '/assets/tirana-streets/map.svg',
    route: '/games/tiranastreets/lobby',
    gameSlugs: ['tiranastreets'],
    roots: ['assets/tirana-streets', 'assets/tirana-detail-kit', 'assets/tirana-landmarks', 'assets/blackwater'],
    excludeRoots: ['assets/tirana-streets/vehicle-collection'],
    excludeFiles: ['assets/tirana-streets/living/human.glb'],
    dependencies: ['shared-tirana-vehicles']
  },
  {
    id: 'racing-royal',
    title: 'Racing Royal',
    description: 'Tracks, vehicles, environments and racing presentation assets.',
    cover: '/assets/kart-royale/cover.webp',
    route: '/games/kartroyale/lobby',
    gameSlugs: ['kartroyale'],
    roots: ['assets/kart-royale'],
    dependencies: ['shared-tirana-vehicles']
  },
  {
    id: 'pool-royale',
    title: 'Pool & Snooker Royale',
    description: 'Tables, arenas, materials, cues and offline game entry assets.',
    cover: '/assets/icons/pool-royale.svg',
    route: '/games/poolroyale/lobby',
    gameSlugs: ['poolroyale', 'snookerroyale'],
    roots: ['assets/pool-royale', 'models/pool-royale'],
    files: [
      'pool-royale-bracket.html',
      'pool-royale-api.js',
      'snooker-royale-bracket.html',
      'snooker-royale-api.js',
      'lib/poolAi.js',
      'game-preloads/pool-royale-preload.txt',
      'game-preloads/snooker-royale-preload.txt',
      'power-slider.js',
      'power-slider.css'
    ],
    dependencies: []
  },
  {
    id: 'table-tennis-royal',
    title: 'Table Tennis & Tennis Royal',
    description: 'Athletes, arenas, rackets, tables and court assets.',
    cover: '/assets/icons/table-tennis-royal.svg',
    route: '/games/tabletennisroyal/lobby',
    gameSlugs: ['tabletennisroyal', 'tennisroyal'],
    roots: ['assets/table-tennis'],
    excludeFiles: [
      'assets/table-tennis/chess-human.glb',
      'assets/table-tennis/athlete-male.glb',
      'assets/table-tennis/athlete-female.glb'
    ],
    dependencies: []
  },
  {
    id: 'royal-lanes',
    title: 'Royal Lanes Bowling',
    description: 'Bowling lane, ball, pin, character and arena assets.',
    cover: '/assets/royal-lanes/mark.svg',
    route: '/games/royallanes/lobby',
    gameSlugs: ['royallanes'],
    roots: ['assets/royal-lanes'],
    dependencies: []
  }
]);

const normalizeRelative = value => value.split(path.sep).join('/').replace(/^\/+/, '');
const publicUrl = relativePath => `/${normalizeRelative(relativePath)}`;
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const withinRoot = (file, root) => file === root || file.startsWith(`${root}/`);

async function walk(directory, publicDir) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolute, publicDir)));
    } else if (entry.isFile()) {
      files.push(normalizeRelative(path.relative(publicDir, absolute)));
    }
  }
  return files;
}

const isEligible = relativePath => PACKABLE_EXTENSIONS.has(path.extname(relativePath).toLowerCase());

async function collectDefinitionFiles(publicDir, definition) {
  const collected = new Set();
  for (const root of definition.roots || []) {
    const normalizedRoot = normalizeRelative(root);
    const files = await walk(path.join(publicDir, normalizedRoot), publicDir);
    for (const file of files) collected.add(file);
  }
  for (const file of definition.files || []) {
    const normalized = normalizeRelative(file);
    try {
      const info = await stat(path.join(publicDir, normalized));
      if (info.isFile()) collected.add(normalized);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  const excludes = (definition.excludeRoots || []).map(normalizeRelative);
  const excludedFiles = new Set((definition.excludeFiles || []).map(normalizeRelative));
  return [...collected]
    .filter(isEligible)
    .filter(file => !excludedFiles.has(file))
    .filter(file => !excludes.some(root => withinRoot(file, root)))
    .sort();
}

async function buildAsset(publicDir, relativePath, cdnBaseUrl) {
  const absolutePath = path.join(publicDir, relativePath);
  const buffer = await readFile(absolutePath);
  const url = publicUrl(relativePath);
  const sourceUrl = cdnBaseUrl ? `${cdnBaseUrl.replace(/\/$/, '')}${url}` : url;
  return {
    url,
    sourceUrl,
    size: buffer.byteLength,
    sha256: sha256(buffer)
  };
}

const packVersion = assets => {
  const digest = createHash('sha256');
  for (const asset of assets) {
    digest.update(`${asset.url}\0${asset.size}\0${asset.sha256}\n`);
  }
  return digest.digest('hex').slice(0, 16);
};

export async function generateGamePackManifests({
  publicDir = DEFAULT_PUBLIC_DIR,
  outputDir = DEFAULT_OUTPUT_DIR,
  definitions = GAME_PACK_DEFINITIONS,
  cdnBaseUrl = process.env.GAME_PACK_CDN_BASE_URL || ''
} = {}) {
  await mkdir(outputDir, { recursive: true });
  const catalogPacks = [];

  for (const definition of definitions) {
    const files = await collectDefinitionFiles(publicDir, definition);
    const assets = [];
    for (const file of files) assets.push(await buildAsset(publicDir, file, cdnBaseUrl));
    const version = packVersion(assets);
    const manifest = {
      schemaVersion: SCHEMA_VERSION,
      id: definition.id,
      version,
      dependencies: definition.dependencies || [],
      totalBytes: assets.reduce((total, asset) => total + asset.size, 0),
      assetCount: assets.length,
      assets
    };
    const manifestFile = `${definition.id}.json`;
    await writeFile(path.join(outputDir, manifestFile), `${JSON.stringify(manifest, null, 2)}\n`);

    catalogPacks.push({
      id: definition.id,
      title: definition.title,
      description: definition.description,
      hidden: Boolean(definition.hidden),
      cover: definition.cover,
      route: definition.route,
      gameSlugs: definition.gameSlugs || [],
      dependencies: definition.dependencies || [],
      version,
      totalBytes: manifest.totalBytes,
      assetCount: manifest.assetCount,
      manifestUrl: `/pwa/game-packs/${manifestFile}`
    });
  }

  const catalog = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: cdnBaseUrl ? 'cdn' : 'same-origin',
    packs: catalogPacks
  };
  await writeFile(path.join(outputDir, 'index.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  return catalog;
}

async function main() {
  const catalog = await generateGamePackManifests();
  const visiblePacks = catalog.packs.filter(pack => !pack.hidden);
  const bytes = visiblePacks.reduce((total, pack) => total + pack.totalBytes, 0);
  console.log(`Generated ${catalog.packs.length} game-pack manifests (${bytes.toLocaleString()} visible-pack bytes).`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
