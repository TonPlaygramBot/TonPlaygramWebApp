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
import { basename, dirname, extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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
  targetGltf:
    'public/models/pool-royale/pool-table-traditional-fizyman/scene.gltf',
  expected: Object.freeze({
    minTriangles: 20000,
    minVertices: 10000,
    minMaterials: 4,
    minTextures: 10,
    minImages: 10
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

function printHelp() {
  console.log(`Install the authentic Pool Royale Traditional table glTF without committing binaries.

This script fetches Sketchfab's converted glTF archive for:
  ${TRADITIONAL_POOL_TABLE.label} by ${TRADITIONAL_POOL_TABLE.author}
  ${TRADITIONAL_POOL_TABLE.sourceUrl}

Usage:
  SKETCHFAB_TOKEN=<token> npm run fetch:pool-royale-traditional-table
  npm run fetch:pool-royale-traditional-table -- --from /path/to/authentic-sketchfab-gltf.zip
  npm run fetch:pool-royale-traditional-table -- --from /path/to/extracted-authentic-gltf-folder
  npm run fetch:pool-royale-traditional-table -- --validate-only

Output:
  ${TRADITIONAL_POOL_TABLE.targetGltf}

The output folder is gitignored so the PR contains source/config/attribution only.
The installed model remains the original Sketchfab glTF: mesh shape, UV mapping,
material slots, .bin payload, and texture files are preserved. Pool Royale can
then personalize materials at runtime without replacing the source topology.
Validation checks the glTF JSON for the original model scale of detail: at least
${TRADITIONAL_POOL_TABLE.expected.minTriangles.toLocaleString()} triangles, ${TRADITIONAL_POOL_TABLE.expected.minVertices.toLocaleString()} vertices, ${TRADITIONAL_POOL_TABLE.expected.minMaterials} materials, and ${TRADITIONAL_POOL_TABLE.expected.minTextures} textures.`);
}

function resolveTargetDir(targetOverride = null) {
  return resolve(targetOverride || TRADITIONAL_POOL_TABLE.targetDir);
}

function resolveTargetGltf(targetDir) {
  return join(targetDir, 'scene.gltf');
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
      `glTF archive download failed ${response.status} ${response.statusText}`
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

async function walkFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function extractZip(zipPath, destination) {
  await mkdir(destination, { recursive: true });
  await execFileAsync('unzip', ['-q', zipPath, '-d', destination]);
}

async function stageSource(sourcePath, tempRoot) {
  const info = await stat(sourcePath);
  if (info.isDirectory()) return sourcePath;
  if (!info.isFile() || extname(sourcePath).toLowerCase() !== '.zip') {
    throw new Error(
      `Expected an authentic Sketchfab glTF .zip or extracted folder, received: ${sourcePath}`
    );
  }
  const extracted = join(tempRoot, 'extracted');
  await extractZip(sourcePath, extracted);
  return extracted;
}

async function findGltfFile(root) {
  const files = await walkFiles(root);
  const gltfs = files.filter((file) => extname(file).toLowerCase() === '.gltf');
  if (gltfs.length === 0)
    throw new Error('No .gltf file found in Sketchfab archive.');
  return gltfs.find((file) => file.endsWith('/scene.gltf')) || gltfs[0];
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

async function assertReferencedFilesExist(gltfPath, json) {
  const base = dirname(gltfPath);
  const refs = [
    ...(Array.isArray(json.buffers) ? json.buffers : []),
    ...(Array.isArray(json.images) ? json.images : [])
  ]
    .map((entry) => entry?.uri)
    .filter(
      (uri) => uri && !uri.startsWith('data:') && !/^https?:\/\//i.test(uri)
    );

  for (const uri of refs) {
    const decoded = decodeURIComponent(uri);
    // eslint-disable-next-line no-await-in-loop
    const refStat = await stat(join(base, decoded));
    if (!refStat.isFile())
      throw new Error(`Referenced glTF asset is not a file: ${uri}`);
  }
}

async function validateAuthenticTraditionalGltf(gltfPath) {
  const json = JSON.parse(await readFile(gltfPath, 'utf8'));
  const summary = summarizeGltf(json);
  const expected = TRADITIONAL_POOL_TABLE.expected;
  assertAtLeast(summary, 'scenes', 1);
  assertAtLeast(summary, 'meshes', 1);
  assertAtLeast(summary, 'buffers', 1);
  assertAtLeast(summary, 'materials', expected.minMaterials);
  assertAtLeast(summary, 'textures', expected.minTextures);
  assertAtLeast(summary, 'images', expected.minImages);
  assertAtLeast(summary, 'triangleCount', expected.minTriangles);
  assertAtLeast(summary, 'vertexCount', expected.minVertices);
  await assertReferencedFilesExist(gltfPath, json);
  return summary;
}

async function installStagedGltf(stagedRoot, targetDir) {
  const gltfPath = await findGltfFile(stagedRoot);
  const sourceDir = dirname(gltfPath);
  const summary = await validateAuthenticTraditionalGltf(gltfPath);
  const tempTarget = `${targetDir}.tmp-${Date.now()}`;
  await rm(tempTarget, { recursive: true, force: true });
  await mkdir(dirname(targetDir), { recursive: true });
  await cp(sourceDir, tempTarget, { recursive: true });
  if (
    join(tempTarget, 'scene.gltf') !==
    join(tempTarget, gltfPath.split('/').pop())
  ) {
    await rm(join(tempTarget, 'scene.gltf'), { force: true });
    await rename(
      join(tempTarget, gltfPath.split('/').pop()),
      join(tempTarget, 'scene.gltf')
    );
  }
  await rm(targetDir, { recursive: true, force: true });
  await rename(tempTarget, targetDir);
  return summary;
}

async function installFromSource(sourcePath, targetDir) {
  const tempRoot = await mkdtemp(
    join(tmpdir(), 'pool-royale-traditional-gltf-')
  );
  try {
    const stagedRoot = await stageSource(sourcePath, tempRoot);
    const summary = await installStagedGltf(stagedRoot, targetDir);
    console.log(
      `Installed authentic Sketchfab glTF to ${resolveTargetGltf(targetDir)}`
    );
    console.log(`Validated ${JSON.stringify(summary)}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function downloadSketchfabGltf(token, targetDir) {
  const apiUrl = `https://api.sketchfab.com/v3/models/${TRADITIONAL_POOL_TABLE.uid}/download`;
  const data = await fetchJson(apiUrl, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json'
    }
  });
  const gltf = data?.gltf?.url;
  if (!gltf) {
    throw new Error('Sketchfab response did not include a gltf.url download.');
  }
  const tempRoot = await mkdtemp(
    join(tmpdir(), 'pool-royale-traditional-gltf-')
  );
  try {
    const archivePath = join(tempRoot, 'sketchfab-traditional-table-gltf.zip');
    await writeFile(archivePath, await downloadBuffer(gltf));
    await installFromSource(archivePath, targetDir);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function validateExisting(targetDir) {
  const targetGltf = resolveTargetGltf(targetDir);
  const summary = await validateAuthenticTraditionalGltf(targetGltf);
  console.log(`Validated existing authentic Sketchfab glTF at ${targetGltf}`);
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
    await installFromSource(args.from, targetDir);
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
