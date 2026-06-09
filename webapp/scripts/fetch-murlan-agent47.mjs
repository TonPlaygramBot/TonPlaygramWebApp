import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const execFileAsync = promisify(execFile);
const WEBAPP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_FILE_NAME = 'scene.gltf';

const SKETCHFAB_CHARACTERS = Object.freeze({
  'agent-47': {
    label: 'Agent 47',
    uid: '1680cad927304bb687d6a9ad5b9dd98a',
    sourceUrl:
      'https://sketchfab.com/3d-models/agent-47-riggedface-morphs-1680cad927304bb687d6a9ad5b9dd98a',
    targetDir: 'public/models/murlan/agent-47-rigged-face-morphs',
    targetFileName: TARGET_FILE_NAME
  },
  'leather-jacket-portrait': {
    label: 'Leather Jacket Portrait',
    uid: 'e4b6a08211c746fe932e0d5041d28812',
    sourceUrl:
      'https://sketchfab.com/3d-models/leather-jacket-portrait-e4b6a08211c746fe932e0d5041d28812',
    targetDir: 'public/models/murlan/leather-jacket-portrait',
    targetFileName: TARGET_FILE_NAME
  },
  'suede-gentleman': {
    label: 'Seated Gentleman in Suede Jacket',
    uid: '8b1101c090d4454caf9f311b3c008946',
    sourceUrl:
      'https://sketchfab.com/3d-models/seated-gentleman-in-suede-jacket-8b1101c090d4454caf9f311b3c008946',
    targetDir: 'public/models/murlan/seated-gentleman-suede-jacket',
    targetFileName: TARGET_FILE_NAME
  },
  'red-hibiscus-hair': {
    label: 'Red Hibiscus in the Hair',
    uid: 'dc65f86920814a4296f930e7d85ab314',
    sourceUrl:
      'https://sketchfab.com/3d-models/red-hibiscus-in-the-hair-dc65f86920814a4296f930e7d85ab314',
    targetDir: 'public/models/murlan/red-hibiscus-in-the-hair',
    targetFileName: TARGET_FILE_NAME
  },
  'casual-confidence': {
    label: 'Casual Confidence',
    uid: 'bff76010d9534241ae6c96a4a46a7959',
    sourceUrl:
      'https://sketchfab.com/3d-models/casual-confidence-bff76010d9534241ae6c96a4a46a7959',
    targetDir: 'public/models/murlan/casual-confidence',
    targetFileName: TARGET_FILE_NAME
  }
});

function parseArgs(argv) {
  const out = {
    asset: 'agent-47',
    from: null,
    targetDir: null,
    target: null,
    validateOnly: false,
    help: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--asset') {
      out.asset = argv[i + 1] || out.asset;
      i += 1;
    } else if (arg === '--from') {
      out.from = argv[i + 1] ? resolve(argv[i + 1]) : null;
      i += 1;
    } else if (arg === '--target-dir') {
      out.targetDir = argv[i + 1] ? resolve(argv[i + 1]) : out.targetDir;
      i += 1;
    } else if (arg === '--target') {
      out.target = argv[i + 1] ? resolve(argv[i + 1]) : out.target;
      i += 1;
    } else if (arg === '--validate-only') {
      out.validateOnly = true;
    } else if (arg === '--help' || arg === '-h') {
      out.help = true;
    }
  }
  return out;
}

function printHelp() {
  const assetList = Object.entries(SKETCHFAB_CHARACTERS)
    .map(
      ([id, asset]) =>
        `  ${id.padEnd(24)} ${asset.label} -> ${asset.targetDir}/${asset.targetFileName}`
    )
    .join('\n');
  console.log(`Install Murlan Royale Sketchfab character glTF folders without committing binaries.

This script fetches Sketchfab's converted glTF ZIP for each configured character, extracts it, validates the glTF JSON plus referenced external files, and writes it to public/models/murlan/.

Usage:
  SKETCHFAB_TOKEN=<token> npm run fetch:murlan-characters
  SKETCHFAB_TOKEN=<token> npm run fetch:murlan-characters -- --asset all
  SKETCHFAB_TOKEN=<token> npm run fetch:murlan-characters -- --asset suede-gentleman
  npm run fetch:murlan-agent47 -- --from /path/to/authentic-sketchfab-gltf.zip
  npm run fetch:murlan-characters -- --asset casual-confidence --from /path/to/extracted-gltf-folder
  npm run fetch:murlan-characters -- --asset red-hibiscus-hair --validate-only

Assets:
${assetList}

The output directories are gitignored so binary textures, buffers, and converted glTF files stay out of pull requests.`);
}

function resolveAsset(assetId) {
  const asset = SKETCHFAB_CHARACTERS[assetId];
  if (!asset) {
    throw new Error(`Unknown --asset "${assetId}". Use --help to list supported assets.`);
  }
  return asset;
}

function resolveTargetDir(asset, targetDirOverride = null, targetOverride = null) {
  if (targetDirOverride) return resolve(targetDirOverride);
  if (targetOverride) return dirname(resolve(targetOverride));
  return resolve(WEBAPP_ROOT, asset.targetDir);
}

function targetGltfPath(asset, targetDir) {
  return join(targetDir, asset.targetFileName || TARGET_FILE_NAME);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${body}`);
  }
  return response.json();
}

async function downloadBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`glTF ZIP download failed ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function pathExists(path) {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}

async function collectFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

async function findGltfFile(root) {
  const files = await collectFiles(root);
  const gltfs = files.filter((file) => extname(file).toLowerCase() === '.gltf');
  if (gltfs.length === 0) throw new Error(`No .gltf file found in ${root}.`);
  return gltfs.find((file) => basename(file).toLowerCase() === TARGET_FILE_NAME) || gltfs[0];
}

async function unzipToTemp(zipPath) {
  const tempDir = await mkdtemp(join(tmpdir(), 'murlan-character-gltf-'));
  await execFileAsync('unzip', ['-q', zipPath, '-d', tempDir]);
  return tempDir;
}

async function readGltfJson(gltfPath) {
  const text = await readFile(gltfPath, 'utf8');
  return JSON.parse(text);
}

function isExternalUri(uri) {
  return (
    typeof uri === 'string' &&
    uri &&
    !uri.startsWith('data:') &&
    !/^https?:\/\//i.test(uri)
  );
}

async function validateExternalReferences(json, gltfDir) {
  const uris = [
    ...(Array.isArray(json.buffers) ? json.buffers.map((buffer) => buffer.uri) : []),
    ...(Array.isArray(json.images) ? json.images.map((image) => image.uri) : [])
  ].filter(isExternalUri);
  if (uris.length === 0) {
    throw new Error('Sketchfab glTF validation failed: expected external buffer or image files.');
  }
  for (const uri of uris) {
    const filePath = resolve(gltfDir, decodeURIComponent(uri));
    if (!(await pathExists(filePath))) {
      throw new Error(`glTF references missing file: ${uri}`);
    }
  }
  return uris;
}

async function validateSketchfabCharacterGltf(gltfPath) {
  const json = await readGltfJson(gltfPath);
  if (!Array.isArray(json.scenes) || json.scenes.length === 0) {
    throw new Error('Sketchfab glTF validation failed: expected at least one scene.');
  }
  if (!Array.isArray(json.meshes) || json.meshes.length === 0) {
    throw new Error('Sketchfab glTF validation failed: expected at least one mesh.');
  }
  if (!Array.isArray(json.nodes) || json.nodes.length === 0) {
    throw new Error('Sketchfab glTF validation failed: expected at least one node.');
  }
  const externalUris = await validateExternalReferences(json, dirname(gltfPath));
  return {
    scenes: json.scenes.length,
    nodes: json.nodes.length,
    meshes: json.meshes.length,
    materials: Array.isArray(json.materials) ? json.materials.length : 0,
    textures: Array.isArray(json.textures) ? json.textures.length : 0,
    images: Array.isArray(json.images) ? json.images.length : 0,
    buffers: Array.isArray(json.buffers) ? json.buffers.length : 0,
    externalFiles: externalUris.length
  };
}

async function installGltfDirectory(asset, sourceGltf, targetDir) {
  const sourceDir = dirname(sourceGltf);
  const summary = await validateSketchfabCharacterGltf(sourceGltf);
  const tmpTarget = `${targetDir}.tmp`;
  await rm(tmpTarget, { recursive: true, force: true });
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(dirname(targetDir), { recursive: true });
  await cp(sourceDir, tmpTarget, { recursive: true });
  const installedGltf = targetGltfPath(asset, tmpTarget);
  const copiedSource = join(tmpTarget, basename(sourceGltf));
  if (basename(sourceGltf) !== (asset.targetFileName || TARGET_FILE_NAME)) {
    await rename(copiedSource, installedGltf);
  }
  await validateSketchfabCharacterGltf(installedGltf);
  await rename(tmpTarget, targetDir);
  return summary;
}

async function installFromZip(asset, zipPath, targetDir) {
  const tempDir = await unzipToTemp(zipPath);
  try {
    const gltfPath = await findGltfFile(tempDir);
    return await installGltfDirectory(asset, gltfPath, targetDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function installFromPath(asset, source, targetDir) {
  if (!source) throw new Error('Missing --from path.');
  const info = await stat(source);
  if (info.isDirectory()) {
    const gltfPath = await findGltfFile(source);
    const summary = await installGltfDirectory(asset, gltfPath, targetDir);
    console.log(`Copied ${asset.label} Sketchfab glTF folder to ${targetDir}`);
    console.log(`Validated ${JSON.stringify(summary)}`);
    return;
  }
  const ext = extname(source).toLowerCase();
  if (ext === '.zip') {
    const summary = await installFromZip(asset, source, targetDir);
    console.log(`Extracted ${asset.label} Sketchfab glTF ZIP to ${targetDir}`);
    console.log(`Validated ${JSON.stringify(summary)}`);
    return;
  }
  if (ext === '.gltf') {
    const summary = await installGltfDirectory(asset, source, targetDir);
    console.log(`Copied ${asset.label} Sketchfab glTF to ${targetDir}`);
    console.log(`Validated ${JSON.stringify(summary)}`);
    return;
  }
  throw new Error(`Expected a Sketchfab glTF .zip, .gltf, or extracted folder, received: ${source}`);
}

async function downloadAsset(asset, token, targetDir) {
  const apiUrl = `https://api.sketchfab.com/v3/models/${asset.uid}/download`;
  const data = await fetchJson(apiUrl, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json'
    }
  });
  const gltfZip = data?.gltf?.url;
  if (!gltfZip) {
    throw new Error(`Sketchfab response did not include a gltf.url download for ${asset.label}.`);
  }
  const tempDir = await mkdtemp(join(tmpdir(), 'murlan-character-download-'));
  const zipPath = join(tempDir, `${asset.uid}-gltf.zip`);
  try {
    await writeFile(zipPath, await downloadBuffer(gltfZip));
    const summary = await installFromZip(asset, zipPath, targetDir);
    console.log(`Downloaded ${asset.label} Sketchfab glTF to ${targetDir}`);
    console.log(`Validated ${JSON.stringify(summary)}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function validateExisting(asset, targetDir) {
  const gltfPath = targetGltfPath(asset, targetDir);
  const summary = await validateSketchfabCharacterGltf(gltfPath);
  console.log(`Validated existing ${asset.label} Sketchfab glTF at ${gltfPath}`);
  console.log(`Validated ${JSON.stringify(summary)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.from && args.asset === 'all') {
    throw new Error('--from can only install one asset at a time. Pass a concrete --asset id.');
  }
  if ((args.targetDir || args.target) && args.asset === 'all') {
    throw new Error('--target-dir/--target can only be used with one concrete --asset id.');
  }

  if (args.asset === 'all') {
    const assets = Object.values(SKETCHFAB_CHARACTERS);
    if (args.validateOnly) {
      for (const asset of assets) {
        // eslint-disable-next-line no-await-in-loop
        await validateExisting(asset, resolveTargetDir(asset));
      }
      return;
    }
    const token = process.env.SKETCHFAB_TOKEN;
    if (!token) {
      printHelp();
      throw new Error('SKETCHFAB_TOKEN is required unless --from or --validate-only is provided.');
    }
    for (const asset of assets) {
      // eslint-disable-next-line no-await-in-loop
      await downloadAsset(asset, token, resolveTargetDir(asset));
    }
    return;
  }

  const asset = resolveAsset(args.asset);
  const targetDir = resolveTargetDir(asset, args.targetDir, args.target);
  if (args.validateOnly) {
    await validateExisting(asset, targetDir);
    return;
  }
  if (args.from) {
    await installFromPath(asset, args.from, targetDir);
    return;
  }

  const token = process.env.SKETCHFAB_TOKEN;
  if (!token) {
    printHelp();
    throw new Error('SKETCHFAB_TOKEN is required unless --from or --validate-only is provided.');
  }
  await downloadAsset(asset, token, targetDir);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
