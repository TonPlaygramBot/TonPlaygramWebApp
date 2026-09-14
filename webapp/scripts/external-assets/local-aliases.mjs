import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const READY_PLAYER_ME_SHA256 = 'b69cec7a5cc7dc7e1c1f19c324024d090ae06e1315441a7bce4bf236112addc1';

function exactSourceAliases(sourceUrl) {
  const aliases = [sourceUrl];
  const source = new URL(sourceUrl);
  let match;
  if (source.hostname === 'raw.githubusercontent.com') {
    match = source.pathname.match(/^\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
  } else if (['cdn.jsdelivr.net', 'fastly.jsdelivr.net'].includes(source.hostname)) {
    match = source.pathname.match(/^\/gh\/([^/]+)\/([^@/]+)@([^/]+)\/(.+)$/);
  }
  if (match) {
    const [, owner, repo, ref, file] = match;
    aliases.push(
      `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${file}`,
      `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${file}`,
      `https://fastly.jsdelivr.net/gh/${owner}/${repo}@${ref}/${file}`,
      `https://cdn.statically.io/gh/${owner}/${repo}/${ref}/${file}`,
      `https://media.githubusercontent.com/media/${owner}/${repo}/${ref}/${file}`
    );
  }
  return [...new Set(aliases)];
}

function modelJson(bytes, url) {
  if (url.endsWith('.gltf')) return JSON.parse(bytes.toString('utf8'));
  if (!url.endsWith('.glb')) return null;
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(16) !== 0x4e4f534a) {
    throw new Error(`Invalid original GLB: ${url}`);
  }
  return JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trim());
}

/**
 * Reuse only original, losslessly embedded, or provider-verified local assets.
 * Never alias main to a pinned commit, another model-folder fallback, a reduced
 * LOD, a rendered thumbnail, or a recompressed/resized texture.
 */
export async function collectVerifiedLocalAssets({ repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const publicRoot = path.join(repoRoot, 'webapp/public');
  const entries = [];
  const verify = async ({ sourceUrl, url, sha256, size, provenance }) => {
    if (!/^https:\/\//.test(sourceUrl || '') || !/^[a-f0-9]{64}$/.test(sha256 || '')) return;
    const filename = path.resolve(publicRoot, url.replace(/^\//, ''));
    if (!filename.startsWith(`${publicRoot}${path.sep}`)) throw new Error(`Invalid local original path: ${url}`);
    let bytes;
    try { bytes = await readFile(filename); } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== sha256 || (size && bytes.length !== size)) {
      throw new Error(`Bundled original checksum mismatch: ${url}`);
    }
    const document = modelJson(bytes, url);
    if (document && [...(document.buffers || []), ...(document.images || [])].some(resource => resource.uri && !resource.uri.startsWith('data:'))) {
      // A standalone alias must not strand dependencies at the old host.
      return;
    }
    entries.push({ sourceUrl, url, size: bytes.length, sha256, aliases: exactSourceAliases(sourceUrl), provenance });
  };

  const originalsPath = 'assets/tirana-streets/imported/manifest.json';
  const originals = JSON.parse(await readFile(path.join(publicRoot, originalsPath), 'utf8'));
  for (const asset of originals) {
    if (asset.status !== 'downloaded') continue;
    await verify({ sourceUrl: asset.sourceUrl, url: asset.localUrl, size: asset.bytes, sha256: asset.sha256, provenance: originalsPath });
  }

  // README explicitly records this as the unchanged supplied original. Pin its
  // current hash and require that provenance; derivative athlete models differ.
  const characterProvenance = 'assets/pool-royale/README.md';
  const characterReadme = await readFile(path.join(publicRoot, characterProvenance), 'utf8');
  if (characterReadme.includes('unchanged character model') && characterReadme.includes('https://threejs.org/examples/models/gltf/readyplayer.me.glb')) {
    await verify({
      sourceUrl: 'https://threejs.org/examples/models/gltf/readyplayer.me.glb',
      url: '/assets/pool-royale/readyplayer.me.glb',
      sha256: READY_PLAYER_ME_SHA256,
      provenance: characterProvenance
    });
  }

  const streetProvenance = 'assets/tirana-streets/materials/street-surfaces-sources.json';
  const surfaces = JSON.parse(await readFile(path.join(publicRoot, streetProvenance), 'utf8'));
  for (const asset of surfaces) {
    await verify({ sourceUrl: asset.url, url: `/assets/tirana-streets/materials/${asset.file}`, size: asset.bytes, sha256: asset.sha256, provenance: streetProvenance });
  }

  const bowlingProvenance = 'assets/royal-lanes/asset-manifest.json';
  const bowling = JSON.parse(await readFile(path.join(publicRoot, bowlingProvenance), 'utf8'));
  const bowlingOriginals = {
    white_maple_veneer_diff_4k: 'maple-color.jpg',
    white_maple_veneer_nor_gl_2k: 'maple-normal.jpg',
    white_maple_veneer_rough_2k: 'maple-roughness.jpg',
    billiard_hall_1k: 'billiard-hall-1k.hdr'
  };
  for (const asset of bowling.files || []) {
    const file = bowlingOriginals[path.parse(asset.filename || '').name];
    if (!file || asset.verified_against_provider !== true) continue;
    await verify({ sourceUrl: asset.url, url: `/assets/royal-lanes/textures/${file}`, size: asset.bytes, sha256: asset.sha256, provenance: bowlingProvenance });
  }

  return entries.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl));
}

export async function collectLocalAliases(options = {}) {
  const entries = await collectVerifiedLocalAssets(options);
  return Object.fromEntries(entries.flatMap(entry => entry.aliases.map(sourceUrl => [sourceUrl, entry.url])).sort(([a], [b]) => a.localeCompare(b)));
}

export default collectLocalAliases;

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = await collectVerifiedLocalAssets({ repoRoot: process.argv[2] || DEFAULT_REPO_ROOT });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
