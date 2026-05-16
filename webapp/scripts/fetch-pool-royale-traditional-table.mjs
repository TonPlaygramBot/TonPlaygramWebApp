import { execFile } from 'node:child_process';
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
import { dirname, extname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
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
  targetFile: 'pool-table-traditional-fizyman.gltf',
  expected: Object.freeze({
    minTriangles: 20000,
    minVertices: 10000,
    minMaterials: 4,
    minTextures: 10,
    minImages: 10
  })
});

function parseArgs(argv) {
  const out = {
    from: null,
    fromDir: null,
    targetDir: null,
    validateOnly: false,
    help: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from') {
      out.from = argv[i + 1] ? resolve(argv[i + 1]) : null;
      i += 1;
    } else if (arg === '--from-dir') {
      out.fromDir = argv[i + 1] ? resolve(argv[i + 1]) : null;
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

function targetDir(targetOverride = null) {
  return resolve(targetOverride || TRADITIONAL_POOL_TABLE.targetDir);
}

function targetGltfPath(targetOverride = null) {
  return join(targetDir(targetOverride), TRADITIONAL_POOL_TABLE.targetFile);
}

function printHelp() {
  console.log(`Install the authentic Pool Royale Traditional table glTF folder without committing binaries.

This script fetches Sketchfab's converted glTF archive for:
  ${TRADITIONAL_POOL_TABLE.label} by ${TRADITIONAL_POOL_TABLE.author}
  ${TRADITIONAL_POOL_TABLE.sourceUrl}

Usage:
  SKETCHFAB_TOKEN=<token> npm run fetch:pool-royale-traditional-table
  npm run fetch:pool-royale-traditional-table -- --from /path/to/authentic-sketchfab-gltf.zip
  npm run fetch:pool-royale-traditional-table -- --from-dir /path/to/extracted/sketchfab-gltf
  npm run fetch:pool-royale-traditional-table -- --validate-only

Output directory:
  ${TRADITIONAL_POOL_TABLE.targetDir}/
Main file:
  ${TRADITIONAL_POOL_TABLE.targetDir}/${TRADITIONAL_POOL_TABLE.targetFile}

The output directory is gitignored so the PR contains source/config/attribution only.
Validation checks the glTF JSON for the original model scale of detail: at least
${TRADITIONAL_POOL_TABLE.expected.minTriangles.toLocaleString()} triangles, ${TRADITIONAL_POOL_TABLE.expected.minVertices.toLocaleString()} vertices, ${TRADITIONAL_POOL_TABLE.expected.minMaterials} materials, and ${TRADITIONAL_POOL_TABLE.expected.minTextures} textures.`);
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

async function listFilesRecursive(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

async function findMainGltf(root) {
  const files = await listFilesRecursive(root);
  const gltfs = files.filter((file) => extname(file).toLowerCase() === '.gltf');
  if (gltfs.length === 0) {
    throw new Error('No .gltf file found in Sketchfab archive.');
  }
  gltfs.sort((a, b) => {
    const score = (file) => {
      const name = file.toLowerCase();
      if (name.endsWith('/scene.gltf')) return 0;
      if (name.endsWith('/model.gltf')) return 1;
      return 2;
    };
    return score(a) - score(b) || a.localeCompare(b);
  });
  return gltfs[0];
}

async function extractZip(zipPath, destination) {
  await mkdir(destination, { recursive: true });
  await execFileAsync('unzip', ['-q', zipPath, '-d', destination]);
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

async function validateAuthenticTraditionalGltf(gltfPath) {
  const json = JSON.parse(await readFile(gltfPath, 'utf8'));
  const summary = summarizeGltf(json);
  const expected = TRADITIONAL_POOL_TABLE.expected;
  assertAtLeast(summary, 'scenes', 1);
  assertAtLeast(summary, 'meshes', 1);
  assertAtLeast(summary, 'materials', expected.minMaterials);
  assertAtLeast(summary, 'textures', expected.minTextures);
  assertAtLeast(summary, 'images', expected.minImages);
  assertAtLeast(summary, 'triangleCount', expected.minTriangles);
  assertAtLeast(summary, 'vertexCount', expected.minVertices);
  return summary;
}

async function installExtractedGltf(sourceRoot, targetOverride = null) {
  const sourceGltf = await findMainGltf(sourceRoot);
  const sourceDir = dirname(sourceGltf);
  const destination = targetDir(targetOverride);
  const tmpDestination = `${destination}.tmp-${Date.now()}`;

  await rm(tmpDestination, { recursive: true, force: true });
  await mkdir(dirname(destination), { recursive: true });
  await cp(sourceDir, tmpDestination, { recursive: true });
  const installedOriginal = join(
    tmpDestination,
    relative(sourceDir, sourceGltf)
  );
  const installedMain = join(tmpDestination, TRADITIONAL_POOL_TABLE.targetFile);
  if (installedOriginal !== installedMain) {
    await rename(installedOriginal, installedMain);
  }

  const summary = await validateAuthenticTraditionalGltf(installedMain);
  await rm(destination, { recursive: true, force: true });
  await rename(tmpDestination, destination);
  return {
    target: join(destination, TRADITIONAL_POOL_TABLE.targetFile),
    summary
  };
}

async function installFromZip(zipPath, targetOverride = null) {
  if (!zipPath) throw new Error('Missing --from path.');
  await stat(zipPath);
  const tmp = await mkdtemp(join(tmpdir(), 'pool-royale-traditional-gltf-'));
  try {
    await extractZip(zipPath, tmp);
    return await installExtractedGltf(tmp, targetOverride);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function downloadSketchfabGltf(token, targetOverride = null) {
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

  const tmp = await mkdtemp(join(tmpdir(), 'pool-royale-traditional-gltf-'));
  const archive = join(tmp, 'sketchfab-gltf.zip');
  try {
    await writeFile(archive, await downloadBuffer(gltf));
    return await installFromZip(archive, targetOverride);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function validateExisting(targetOverride = null) {
  const target = targetGltfPath(targetOverride);
  const summary = await validateAuthenticTraditionalGltf(target);
  return { target, summary };
}

function logInstalled({ target, summary }, action) {
  console.log(`${action} ${target}`);
  console.log(`Validated ${JSON.stringify(summary)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.validateOnly) {
    logInstalled(
      await validateExisting(args.targetDir),
      'Validated existing authentic Sketchfab glTF at'
    );
    return;
  }

  if (args.fromDir) {
    logInstalled(
      await installExtractedGltf(args.fromDir, args.targetDir),
      'Installed authentic Sketchfab glTF folder at'
    );
    return;
  }

  if (args.from) {
    logInstalled(
      await installFromZip(args.from, args.targetDir),
      'Installed authentic Sketchfab glTF archive at'
    );
    return;
  }

  const token = process.env.SKETCHFAB_TOKEN;
  if (!token) {
    printHelp();
    throw new Error(
      'SKETCHFAB_TOKEN is required unless --from, --from-dir, or --validate-only is provided.'
    );
  }
  logInstalled(
    await downloadSketchfabGltf(token, args.targetDir),
    'Downloaded authentic Sketchfab glTF to'
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
