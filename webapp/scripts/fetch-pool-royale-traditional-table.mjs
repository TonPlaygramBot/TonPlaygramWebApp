import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webappRoot = join(__dirname, '..');
const target = join(
  webappRoot,
  'public/models/pool-royale/traditional-fizyman-eight-foot/pool_table_traditional.glb'
);

const DEFAULT_DOWNLOAD_SOURCE = join(
  os.homedir(),
  'Downloads',
  'pool_table_traditional.glb'
);

function resolveSource() {
  const argSource = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  return (
    argSource ||
    process.env.POOL_ROYALE_TRADITIONAL_TABLE_SOURCE ||
    DEFAULT_DOWNLOAD_SOURCE
  );
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || '');
}

async function pathExists(path) {
  try {
    await access(path, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function readSourceBytes(source) {
  if (isHttpUrl(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Download failed with HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  const sourcePath = isAbsolute(source)
    ? source
    : resolve(process.cwd(), source);
  if (!(await pathExists(sourcePath))) {
    throw new Error(
      `Traditional table GLB not found at ${sourcePath}. Pass a source path or set POOL_ROYALE_TRADITIONAL_TABLE_SOURCE.`
    );
  }
  return readFile(sourcePath);
}

function readGlbChunks(bytes) {
  if (bytes.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error('Source is not a binary glTF (.glb) file.');
  }
  const version = bytes.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`Unsupported GLB version ${version}; expected version 2.`);
  }

  const chunks = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.toString('utf8', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end > bytes.length) {
      throw new Error(`Invalid GLB chunk length for ${type}.`);
    }
    chunks.push({ type, bytes: bytes.subarray(start, end) });
    offset = end;
  }
  return chunks;
}

function findTableNodeIndex(json) {
  const nodes = Array.isArray(json.nodes) ? json.nodes : [];
  const candidates = nodes
    .map((node, index) => ({ node, index, name: `${node?.name || ''}` }))
    .filter(({ name }) => /pool\s*table|pooltable|table/i.test(name));

  const namedRoot = candidates.find(({ node }) =>
    Array.isArray(node.children) && node.children.length > 0
  );
  const namedMesh = candidates.find(({ node }) => Number.isInteger(node.mesh));
  const match = namedRoot || namedMesh;
  if (!match) {
    throw new Error('Could not find a pool table node in the source GLB.');
  }
  return match.index;
}

function buildParentMap(nodes) {
  const parents = new Map();
  nodes.forEach((node, index) => {
    if (!Array.isArray(node?.children)) return;
    node.children.forEach((childIndex) => parents.set(childIndex, index));
  });
  return parents;
}

function pruneSceneToNode(json, tableNodeIndex) {
  const nodes = Array.isArray(json.nodes) ? json.nodes : [];
  const parents = buildParentMap(nodes);
  const path = [];
  let cursor = tableNodeIndex;
  while (Number.isInteger(cursor)) {
    path.unshift(cursor);
    cursor = parents.get(cursor);
  }

  if (path.length === 0) return;
  const pathNextByParent = new Map();
  for (let index = 0; index < path.length - 1; index += 1) {
    pathNextByParent.set(path[index], path[index + 1]);
  }

  pathNextByParent.forEach((childIndex, parentIndex) => {
    nodes[parentIndex] = {
      ...nodes[parentIndex],
      children: [childIndex]
    };
  });

  const scene = json.scenes?.[json.scene || 0];
  if (scene && Array.isArray(scene.nodes)) {
    scene.nodes = [path[0]];
  }
}

function padJsonChunk(jsonText) {
  const padding = (4 - (Buffer.byteLength(jsonText) % 4)) % 4;
  return Buffer.from(jsonText + ' '.repeat(padding), 'utf8');
}

function writeChunk(type, data) {
  const header = Buffer.alloc(8);
  header.writeUInt32LE(data.length, 0);
  header.write(type, 4, 4, 'utf8');
  return Buffer.concat([header, data]);
}

function buildGlb(json, binChunk) {
  const jsonChunk = padJsonChunk(JSON.stringify(json));
  const chunks = [writeChunk('JSON', jsonChunk)];
  if (binChunk) {
    chunks.push(writeChunk('BIN\0', binChunk));
  }

  const length = 12 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 4, 'utf8');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(length, 8);
  return Buffer.concat([header, ...chunks], length);
}

function buildTableOnlyGlb(bytes) {
  const chunks = readGlbChunks(bytes);
  const jsonChunk = chunks.find((chunk) => chunk.type === 'JSON');
  const binChunk = chunks.find((chunk) => chunk.type === 'BIN\0');
  if (!jsonChunk) throw new Error('Missing GLB JSON chunk.');

  const json = JSON.parse(jsonChunk.bytes.toString('utf8').trim());
  const tableNodeIndex = findTableNodeIndex(json);
  pruneSceneToNode(json, tableNodeIndex);
  json.asset = {
    ...(json.asset || {}),
    extras: {
      ...(json.asset?.extras || {}),
      sourceRuntimeNote:
        'Pool Royale table-only scene generated from the CC-BY Pool Table Traditional source by fizyman.'
    }
  };
  return buildGlb(json, binChunk?.bytes);
}

const source = resolveSource();
const sourceBytes = await readSourceBytes(source);
if (sourceBytes.byteLength < 100_000) {
  throw new Error(
    `Traditional table GLB is unexpectedly small (${sourceBytes.byteLength} bytes).`
  );
}

const runtimeBytes = buildTableOnlyGlb(sourceBytes);
await mkdir(dirname(target), { recursive: true });
await rm(target, { force: true });
await writeFile(target, runtimeBytes);
console.log(
  `Installed Traditional 8 ft table GLB (${runtimeBytes.byteLength} bytes) at ${target}`
);
