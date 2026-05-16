import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const TRADITIONAL_POOL_TABLE = Object.freeze({
  id: 'traditional-fizyman-eight-foot',
  label: 'Pool Table Traditional',
  author: 'fizyman',
  uid: 'e0b938c0c2e74eb794a49ebde2543977',
  sourceUrl:
    'https://sketchfab.com/3d-models/pool-table-traditional-e0b938c0c2e74eb794a49ebde2543977',
  license: 'CC Attribution 4.0',
  target: 'public/models/pool-royale/pool-table-traditional-fizyman.glb',
  expected: Object.freeze({
    minTriangles: 20000,
    minVertices: 10000,
    minMaterials: 4,
    minTextures: 10,
    minImages: 10
  })
});

function parseArgs(argv) {
  const out = { from: null, target: null, validateOnly: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from') {
      out.from = argv[i + 1] ? resolve(argv[i + 1]) : null;
      i += 1;
    } else if (arg === '--target') {
      out.target = argv[i + 1] ? resolve(argv[i + 1]) : null;
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
  console.log(`Install the authentic Pool Royale Traditional table GLB without committing binaries.

This script fetches Sketchfab's converted GLB for:
  ${TRADITIONAL_POOL_TABLE.label} by ${TRADITIONAL_POOL_TABLE.author}
  ${TRADITIONAL_POOL_TABLE.sourceUrl}

Usage:
  SKETCHFAB_TOKEN=<token> npm run fetch:pool-royale-traditional-table
  npm run fetch:pool-royale-traditional-table -- --from /path/to/authentic-sketchfab-download.glb
  npm run fetch:pool-royale-traditional-table -- --validate-only

Output:
  ${TRADITIONAL_POOL_TABLE.target}

The output path is gitignored so the PR contains source/config/attribution only.
Validation checks the GLB JSON for the original model scale of detail: at least
${TRADITIONAL_POOL_TABLE.expected.minTriangles.toLocaleString()} triangles, ${TRADITIONAL_POOL_TABLE.expected.minVertices.toLocaleString()} vertices, ${TRADITIONAL_POOL_TABLE.expected.minMaterials} materials, and ${TRADITIONAL_POOL_TABLE.expected.minTextures} textures.`);
}

function resolveTarget(targetOverride = null) {
  return resolve(targetOverride || TRADITIONAL_POOL_TABLE.target);
}

async function ensureTargetDir(target) {
  await mkdir(dirname(target), { recursive: true });
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
      `GLB download failed ${response.status} ${response.statusText}`
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

function readGlbJson(buffer) {
  if (buffer.length < 20) throw new Error('GLB is too small to be valid.');
  if (buffer.readUInt32LE(0) !== 0x46546c67) {
    throw new Error('Expected binary glTF magic header (glTF).');
  }
  const version = buffer.readUInt32LE(4);
  if (version !== 2)
    throw new Error(`Expected glTF 2.0 GLB, received version ${version}.`);
  const declaredLength = buffer.readUInt32LE(8);
  if (declaredLength !== buffer.length) {
    throw new Error(
      `GLB length mismatch: header=${declaredLength}, actual=${buffer.length}.`
    );
  }
  const jsonLength = buffer.readUInt32LE(12);
  const jsonChunkType = buffer.readUInt32LE(16);
  if (jsonChunkType !== 0x4e4f534a)
    throw new Error('First GLB chunk is not JSON.');
  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonLength;
  if (jsonEnd > buffer.length)
    throw new Error('GLB JSON chunk extends past file length.');
  return JSON.parse(buffer.subarray(jsonStart, jsonEnd).toString('utf8'));
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
      `Authentic Sketchfab GLB validation failed: expected ${key} >= ${expected}, received ${summary[key] || 0}.`
    );
  }
}

function validateAuthenticTraditionalGlb(buffer) {
  const json = readGlbJson(buffer);
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

async function writeValidatedGlb(buffer, target) {
  const summary = validateAuthenticTraditionalGlb(buffer);
  await ensureTargetDir(target);
  const tmp = `${target}.tmp`;
  await writeFile(tmp, buffer);
  await rename(tmp, target);
  return summary;
}

async function copyLocalGlb(source, target) {
  if (!source) throw new Error('Missing --from path.');
  if (!source.toLowerCase().endsWith('.glb')) {
    throw new Error(
      `Expected an authentic Sketchfab .glb file, received: ${source}`
    );
  }
  await stat(source);
  const buffer = await readFile(source);
  const summary = await writeValidatedGlb(buffer, target);
  console.log(`Copied authenticated Sketchfab GLB to ${target}`);
  console.log(`Validated ${JSON.stringify(summary)}`);
}

async function downloadSketchfabGlb(token, target) {
  const apiUrl = `https://api.sketchfab.com/v3/models/${TRADITIONAL_POOL_TABLE.uid}/download`;
  const data = await fetchJson(apiUrl, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json'
    }
  });
  const glb = data?.glb?.url;
  if (!glb) {
    throw new Error('Sketchfab response did not include a glb.url download.');
  }
  const buffer = await downloadBuffer(glb);
  try {
    const summary = await writeValidatedGlb(buffer, target);
    console.log(
      `Downloaded authentic Sketchfab GLB to ${target} (${buffer.length.toLocaleString()} bytes)`
    );
    console.log(`Validated ${JSON.stringify(summary)}`);
  } catch (error) {
    await rm(`${target}.tmp`, { force: true }).catch(() => {});
    throw error;
  }
}

async function validateExisting(target) {
  const buffer = await readFile(target);
  const summary = validateAuthenticTraditionalGlb(buffer);
  console.log(`Validated existing authentic Sketchfab GLB at ${target}`);
  console.log(`Validated ${JSON.stringify(summary)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const target = resolveTarget(args.target);
  if (args.validateOnly) {
    await validateExisting(target);
    return;
  }

  if (args.from) {
    await copyLocalGlb(args.from, target);
    return;
  }

  const token = process.env.SKETCHFAB_TOKEN;
  if (!token) {
    printHelp();
    throw new Error(
      'SKETCHFAB_TOKEN is required unless --from or --validate-only is provided.'
    );
  }
  await downloadSketchfabGlb(token, target);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
