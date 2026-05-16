import { copyFile, cp, mkdtemp, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import process from 'node:process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WEBAPP_ROOT = resolve(SCRIPT_DIR, '..');

function toWebappPath(relativePath) {
  return resolve(WEBAPP_ROOT, relativePath);
}

const SKETCHFAB_CHARACTERS = Object.freeze({
  'agent-47': {
    label: 'Agent 47',
    uid: '1680cad927304bb687d6a9ad5b9dd98a',
    targetDir: toWebappPath('public/models/murlan/agent-47-rigged-face-morphs'),
    entry: 'scene.gltf'
  },
  'leather-jacket-portrait': {
    label: 'Leather Jacket Portrait',
    uid: 'e4b6a08211c746fe932e0d5041d28812',
    targetDir: toWebappPath('public/models/murlan/leather-jacket-portrait'),
    entry: 'scene.gltf'
  },
  'suede-gentleman': {
    label: 'Seated Gentleman in Suede Jacket',
    uid: '8b1101c090d4454caf9f311b3c008946',
    targetDir: toWebappPath('public/models/murlan/seated-gentleman-suede-jacket'),
    entry: 'scene.gltf'
  },
  'red-hibiscus-hair': {
    label: 'Red Hibiscus in the Hair',
    uid: 'dc65f86920814a4296f930e7d85ab314',
    targetDir: toWebappPath('public/models/murlan/red-hibiscus-in-the-hair'),
    entry: 'scene.gltf'
  },
  'casual-confidence': {
    label: 'Casual Confidence',
    uid: 'bff76010d9534241ae6c96a4a46a7959',
    targetDir: toWebappPath('public/models/murlan/casual-confidence'),
    entry: 'scene.gltf'
  }
});

function parseArgs(argv) {
  const out = { asset: 'agent-47', from: null, target: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--asset') {
      out.asset = argv[i + 1] || out.asset;
      i += 1;
    } else if (arg === '--from') {
      out.from = argv[i + 1] ? resolve(argv[i + 1]) : null;
      i += 1;
    } else if (arg === '--target') {
      out.target = argv[i + 1] ? resolve(argv[i + 1]) : out.target;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      out.help = true;
    }
  }
  return out;
}

function resolveTargetDir(asset, targetOverride = null) {
  return targetOverride ? resolve(targetOverride) : asset.targetDir;
}

function assetEntryPath(asset, targetOverride = null) {
  return join(resolveTargetDir(asset, targetOverride), asset.entry || 'scene.gltf');
}

function printHelp() {
  const assetList = Object.entries(SKETCHFAB_CHARACTERS)
    .map(([id, asset]) => `  ${id.padEnd(24)} ${asset.label} -> ${assetEntryPath(asset)}`)
    .join('\n');
  console.log(`Install Murlan Royale Sketchfab character glTF folders without committing binaries.\n\nUsage:\n  SKETCHFAB_TOKEN=<token> npm run fetch:murlan-characters\n  SKETCHFAB_TOKEN=<token> npm run fetch:murlan-characters -- --asset all\n  SKETCHFAB_TOKEN=<token> npm run fetch:murlan-characters -- --asset suede-gentleman\n  npm run fetch:murlan-agent47 -- --from /path/to/sketchfab-gltf.zip\n  npm run fetch:murlan-characters -- --asset casual-confidence --from /path/to/extracted-gltf-folder\n\nAssets:\n${assetList}\n\nOutput directory:\n  ${toWebappPath('public/models/murlan/<asset>/scene.gltf')}\n\nThe output folders are gitignored so glTF .bin/textures stay out of pull requests.`);
}

function resolveAsset(assetId) {
  const asset = SKETCHFAB_CHARACTERS[assetId];
  if (!asset) {
    throw new Error(`Unknown --asset "${assetId}". Use --help to list supported assets.`);
  }
  return asset;
}

async function ensureTargetDir(target) {
  await mkdir(target, { recursive: true });
}

async function findFirstFileByExtension(root, extension) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      const found = await findFirstFileByExtension(fullPath, extension);
      if (found) return found;
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === extension) {
      return fullPath;
    }
  }
  return null;
}

function runPythonZipExtract(zipPath, outDir) {
  const code = [
    'import sys, zipfile',
    'zip_path, out_dir = sys.argv[1], sys.argv[2]',
    'with zipfile.ZipFile(zip_path) as z:',
    '    z.extractall(out_dir)'
  ].join('\n');
  return new Promise((resolvePromise, reject) => {
    const child = spawn('python3', ['-c', code, zipPath, outDir], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (codeNumber) => {
      if (codeNumber === 0) resolvePromise();
      else reject(new Error(`Failed to extract glTF zip with python3: ${stderr || `exit ${codeNumber}`}`));
    });
  });
}

async function replaceDirectory(sourceDir, targetDir) {
  const stagingDir = `${targetDir}.tmp-${process.pid}-${Date.now()}`;
  await rm(stagingDir, { recursive: true, force: true });
  try {
    await mkdir(dirname(stagingDir), { recursive: true });
    await cp(sourceDir, stagingDir, { recursive: true });
    await rm(targetDir, { recursive: true, force: true });
    await rename(stagingDir, targetDir);
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function installExtractedGltfFolder(sourceDir, targetDir, entryName = 'scene.gltf') {
  const gltfPath = await findFirstFileByExtension(sourceDir, '.gltf');
  if (!gltfPath) {
    throw new Error(`No .gltf file found in ${sourceDir}`);
  }

  const gltfDir = dirname(gltfPath);
  await replaceDirectory(gltfDir, targetDir);

  const installedGltfPath = join(targetDir, gltfPath.slice(gltfDir.length + 1));
  const expectedEntryPath = join(targetDir, entryName);
  if (installedGltfPath !== expectedEntryPath) {
    await copyFile(installedGltfPath, expectedEntryPath);
  }
  console.log(`Installed glTF folder to ${targetDir}`);
  console.log(`Entry point: ${expectedEntryPath}`);
}

async function installLocalSource(source, targetDir, entryName = 'scene.gltf') {
  if (!source) throw new Error('Missing --from path.');
  const sourceStat = await stat(source);
  if (sourceStat.isDirectory()) {
    await installExtractedGltfFolder(source, targetDir, entryName);
    return;
  }

  const ext = extname(source).toLowerCase();
  if (ext === '.zip') {
    const tempRoot = await mkdtemp(join(tmpdir(), 'murlan-gltf-'));
    try {
      await runPythonZipExtract(source, tempRoot);
      await installExtractedGltfFolder(tempRoot, targetDir, entryName);
    } finally {
      await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }
    return;
  }

  if (ext === '.gltf') {
    await installExtractedGltfFolder(dirname(source), targetDir, entryName);
    return;
  }

  throw new Error(`Expected --from to be a Sketchfab glTF .zip, extracted folder, or .gltf file. Received: ${source}`);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${body}`);
  }
  return response.json();
}

async function downloadZip(downloadUrl, targetZip) {
  await mkdir(dirname(targetZip), { recursive: true });
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`glTF zip download failed ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const tmp = `${targetZip}.tmp`;
  await writeFile(tmp, buffer);
  await rename(tmp, targetZip);
  console.log(`Downloaded Sketchfab glTF zip (${buffer.length.toLocaleString()} bytes)`);
}

async function downloadAsset(asset, token, targetOverride = null) {
  const targetDir = resolveTargetDir(asset, targetOverride);
  const tempRoot = await mkdtemp(join(tmpdir(), 'murlan-gltf-'));
  const zipPath = join(tempRoot, `${asset.uid}.zip`);
  const extractDir = join(tempRoot, 'extract');
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

  try {
    await downloadZip(gltfZip, zipPath);
    await ensureTargetDir(extractDir);
    await runPythonZipExtract(zipPath, extractDir);
    await installExtractedGltfFolder(extractDir, targetDir, asset.entry || 'scene.gltf');
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.from) {
    if (args.asset === 'all') {
      throw new Error('--from can only install one asset at a time. Pass a concrete --asset id.');
    }
    const asset = resolveAsset(args.asset);
    await installLocalSource(args.from, resolveTargetDir(asset, args.target), asset.entry || 'scene.gltf');
    console.log(`Installed ${asset.label}: ${assetEntryPath(asset, args.target)}`);
    return;
  }

  const token = process.env.SKETCHFAB_TOKEN;
  if (!token) {
    printHelp();
    throw new Error('SKETCHFAB_TOKEN is required unless --from is provided.');
  }

  if (args.asset === 'all') {
    for (const asset of Object.values(SKETCHFAB_CHARACTERS)) {
      // eslint-disable-next-line no-await-in-loop
      await downloadAsset(asset, token);
    }
    return;
  }

  await downloadAsset(resolveAsset(args.asset), token, args.target);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
