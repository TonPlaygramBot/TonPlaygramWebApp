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
import process from 'node:process';

const execFileAsync = promisify(execFile);

const TRADITIONAL_POOL_TABLE = Object.freeze({
  id: 'traditional-fizyman-eight-foot',
  label: 'Pool Table Traditional',
  author: 'fizyman',
  uid: 'e0b938c0c2e74eb794a49ebde2543977',
  sourceUrl:
    'https://sketchfab.com/3d-models/pool-table-traditional-e0b938c0c2e74eb794a49ebde2543977',
  license: 'CC Attribution 4.0',
  targetDir: 'public/models/pool-royale/pool-table-traditional-fizyman',
  targetFileName: 'scene.gltf',
  expected: Object.freeze({
    minTriangles: 20000,
    minVertices: 10000,
    minMaterials: 4,
    minTextures: 10,
    minImages: 10,
    minExternalFiles: 11
  })
});

function parseArgs(argv) {
  const out = { from: null, targetDir: null, validateOnly: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from') {
      out.from = argv[i + 1] ? resolve(argv[i + 1]) : null;
      i += 1;
    } else if (arg === '--target-dir') {
      out.targetDir = argv[i + 1] ? resolve(argv[i + 1]) : null;
      i += 1;
    } else if (arg === '--validate-only') {
      out.validateOnly = true;
    } else if (arg === '--help' || arg === '-h') {
      out.help = true;
    }
  }
  return out;
}

function targetGltfPath(targetDir) {
  return join(targetDir, TRADITIONAL_POOL_TABLE.targetFileName);
}

function printHelp() {
  console.log(`Install the authentic Pool Royale Traditional table glTF without committing model binaries.

This script fetches Sketchfab's converted glTF ZIP for:
  ${TRADITIONAL_POOL_TABLE.label} by ${TRADITIONAL_POOL_TABLE.author}
  ${TRADITIONAL_POOL_TABLE.sourceUrl}

Usage:
  SKETCHFAB_TOKEN=<token> npm run fetch:pool-royale-traditional-table
  npm run fetch:pool-royale-traditional-table -- --from /path/to/authentic-sketchfab-gltf.zip
  npm run fetch:pool-royale-traditional-table -- --from /path/to/extracted-gltf-folder
  npm run fetch:pool-royale-traditional-table -- --validate-only

Output:
  ${TRADITIONAL_POOL_TABLE.targetDir}/${TRADITIONAL_POOL_TABLE.targetFileName}

The output folder is gitignored so the PR contains source/config/attribution only.
Validation checks the glTF JSON and referenced texture/bin files for the original
model scale of detail: at least ${TRADITIONAL_POOL_TABLE.expected.minTriangles.toLocaleString()} triangles, ${TRADITIONAL_POOL_TABLE.expected.minVertices.toLocaleString()} vertices, ${TRADITIONAL_POOL_TABLE.expected.minMaterials} materials, ${TRADITIONAL_POOL_TABLE.expected.minTextures} textures, and ${TRADITIONAL_POOL_TABLE.expected.minImages} images.`);
}

function resolveTargetDir(targetDirOverride = null) {
  return resolve(targetDirOverride || TRADITIONAL_POOL_TABLE.targetDir);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Request failed ${response.status} ${response.statusText}: ${body}`
    );
  }
  return response.json();
}

async function downloadBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `glTF ZIP download failed ${response.status} ${response.statusText}`
    );
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
  return (
    gltfs.find((file) => basename(file).toLowerCase() === 'scene.gltf') ||
    gltfs[0]
  );
}

async function unzipToTemp(zipPath) {
  const tempDir = await mkdtemp(
    join(tmpdir(), 'pool-royale-traditional-gltf-')
  );
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

function primitiveTriangleCount(primitive, accessors = []) {
  if (!primitive || (primitive.mode != null && primitive.mode !== 4)) return 0;
  const indexAccessor = accessors[primitive.indices];
  if (indexAccessor?.count) return Math.floor(indexAccessor.count / 3);
  const positionAccessor = accessors[primitive.attributes?.POSITION];
  return positionAccessor?.count ? Math.floor(positionAccessor.count / 3) : 0;
}

function summarizeGltf(json) {
  const meshes = Array.isArray(json.meshes) ? json.meshes : [];
  const accessors = Array.isArray(json.accessors) ? json.accessors : [];
  const primitives = meshes.flatMap((mesh) =>
    Array.isArray(mesh.primitives) ? mesh.primitives : []
  );
  const triangleCount = primitives.reduce(
    (sum, primitive) => sum + primitiveTriangleCount(primitive, accessors),
    0
  );
  const vertexAccessorIndexes = new Set(
    primitives
      .map((primitive) => primitive?.attributes?.POSITION)
      .filter((index) => Number.isInteger(index))
  );
  const vertexCount = Array.from(vertexAccessorIndexes).reduce(
    (sum, index) => sum + (accessors[index]?.count || 0),
    0
  );
  return {
    scenes: Array.isArray(json.scenes) ? json.scenes.length : 0,
    meshes: meshes.length,
    primitives: primitives.length,
    materials: Array.isArray(json.materials) ? json.materials.length : 0,
    textures: Array.isArray(json.textures) ? json.textures.length : 0,
    images: Array.isArray(json.images) ? json.images.length : 0,
    buffers: Array.isArray(json.buffers) ? json.buffers.length : 0,
    triangleCount,
    vertexCount
  };
}

function assertAtLeast(summary, key, expected) {
  if ((summary[key] || 0) < expected) {
    throw new Error(
      `Authentic Sketchfab glTF validation failed: expected ${key} >= ${expected}, received ${summary[key] || 0}.`
    );
  }
}

async function validateExternalReferences(json, gltfDir) {
  const uris = [
    ...(Array.isArray(json.buffers)
      ? json.buffers.map((buffer) => buffer.uri)
      : []),
    ...(Array.isArray(json.images) ? json.images.map((image) => image.uri) : [])
  ].filter(isExternalUri);
  if (uris.length < TRADITIONAL_POOL_TABLE.expected.minExternalFiles) {
    throw new Error(
      `Authentic Sketchfab glTF validation failed: expected at least ${TRADITIONAL_POOL_TABLE.expected.minExternalFiles} external texture/bin files, received ${uris.length}.`
    );
  }
  for (const uri of uris) {
    const filePath = resolve(gltfDir, decodeURIComponent(uri));
    if (!(await pathExists(filePath))) {
      throw new Error(`glTF references missing file: ${uri}`);
    }
  }
  return uris;
}

async function validateAuthenticTraditionalGltf(gltfPath) {
  const json = await readGltfJson(gltfPath);
  const gltfDir = dirname(gltfPath);
  const summary = summarizeGltf(json);
  const expected = TRADITIONAL_POOL_TABLE.expected;
  assertAtLeast(summary, 'scenes', 1);
  assertAtLeast(summary, 'meshes', 1);
  assertAtLeast(summary, 'materials', expected.minMaterials);
  assertAtLeast(summary, 'textures', expected.minTextures);
  assertAtLeast(summary, 'images', expected.minImages);
  assertAtLeast(summary, 'buffers', 1);
  assertAtLeast(summary, 'triangleCount', expected.minTriangles);
  assertAtLeast(summary, 'vertexCount', expected.minVertices);
  const externalUris = await validateExternalReferences(json, gltfDir);
  return { ...summary, externalFiles: externalUris.length };
}

async function installGltfDirectory(sourceGltf, targetDir) {
  const sourceDir = dirname(sourceGltf);
  const summary = await validateAuthenticTraditionalGltf(sourceGltf);
  const tmpTarget = `${targetDir}.tmp`;
  await rm(tmpTarget, { recursive: true, force: true });
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(dirname(targetDir), { recursive: true });
  await cp(sourceDir, tmpTarget, { recursive: true });
  const installedGltf = join(tmpTarget, TRADITIONAL_POOL_TABLE.targetFileName);
  const copiedSource = join(tmpTarget, basename(sourceGltf));
  if (basename(sourceGltf) !== TRADITIONAL_POOL_TABLE.targetFileName) {
    await rename(copiedSource, installedGltf);
  }
  await validateAuthenticTraditionalGltf(installedGltf);
  await rename(tmpTarget, targetDir);
  return summary;
}

async function installFromZip(zipPath, targetDir) {
  const tempDir = await unzipToTemp(zipPath);
  try {
    const gltfPath = await findGltfFile(tempDir);
    return await installGltfDirectory(gltfPath, targetDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function installFromPath(source, targetDir) {
  if (!source) throw new Error('Missing --from path.');
  const info = await stat(source);
  if (info.isDirectory()) {
    const gltfPath = await findGltfFile(source);
    const summary = await installGltfDirectory(gltfPath, targetDir);
    console.log(`Copied authentic Sketchfab glTF folder to ${targetDir}`);
    console.log(`Validated ${JSON.stringify(summary)}`);
    return;
  }
  const ext = extname(source).toLowerCase();
  if (ext === '.zip') {
    const summary = await installFromZip(source, targetDir);
    console.log(`Extracted authentic Sketchfab glTF ZIP to ${targetDir}`);
    console.log(`Validated ${JSON.stringify(summary)}`);
    return;
  }
  if (ext === '.gltf') {
    const summary = await installGltfDirectory(source, targetDir);
    console.log(`Copied authentic Sketchfab glTF to ${targetDir}`);
    console.log(`Validated ${JSON.stringify(summary)}`);
    return;
  }
  throw new Error(
    `Expected a Sketchfab glTF .zip, .gltf, or extracted folder, received: ${source}`
  );
}

async function downloadSketchfabGltf(token, targetDir) {
  const apiUrl = `https://api.sketchfab.com/v3/models/${TRADITIONAL_POOL_TABLE.uid}/download`;
  const data = await fetchJson(apiUrl, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json'
    }
  });
  const gltfZip = data?.gltf?.url;
  if (!gltfZip) {
    throw new Error('Sketchfab response did not include a gltf.url download.');
  }
  const tempDir = await mkdtemp(
    join(tmpdir(), 'pool-royale-traditional-download-')
  );
  const zipPath = join(tempDir, 'pool-table-traditional-gltf.zip');
  try {
    await writeFile(zipPath, await downloadBuffer(gltfZip));
    const summary = await installFromZip(zipPath, targetDir);
    console.log(`Downloaded authentic Sketchfab glTF to ${targetDir}`);
    console.log(`Validated ${JSON.stringify(summary)}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function validateExisting(targetDir) {
  const gltfPath = targetGltfPath(targetDir);
  const summary = await validateAuthenticTraditionalGltf(gltfPath);
  console.log(`Validated existing authentic Sketchfab glTF at ${gltfPath}`);
  console.log(`Validated ${JSON.stringify(summary)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const targetDir = resolveTargetDir(args.targetDir);
  if (args.validateOnly) {
    await validateExisting(targetDir);
    return;
  }

  if (args.from) {
    await installFromPath(args.from, targetDir);
    return;
  }

  const token = process.env.SKETCHFAB_TOKEN;
  if (!token) {
    printHelp();
    throw new Error(
      'SKETCHFAB_TOKEN is required unless --from or --validate-only is provided.'
    );
  }
  await downloadSketchfabGltf(token, targetDir);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
