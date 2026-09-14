import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { shouldExcludeWeaponKartGame } from '../../webapp/scripts/external-assets/source-inventory.mjs';

const DEFAULT_REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SOURCE_EXTENSIONS = /\.(?:[cm]?js|jsx|ts|tsx|html)$/i;
const MODEL_EXTENSION = /\.(?:glb|gltf|fbx|obj|mtl|bin)(?:[?#]|$)/i;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
// UPose credits these exact original avatar URLs in README.md. Its archived
// GLBs retain Ready Player Me's generator, embedded PNGs and authored skeleton.
const READY_PLAYER_ME_ARCHIVE_REF = 'f0aeefe6a34a8ce71e47519a11a2bc67203c082f';
const READY_PLAYER_ME_ARCHIVE_IDS = new Set([
  '67d411b30787acbf58ce58ac',
  '67f433b69dc08cf26d2cf585',
  '67e1b51ae11c93725e4395c9'
]);

async function runtimeSources(repoRoot) {
  const sources = [];
  async function visit(directory, recursive) {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith('.') || /(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory() && recursive) await visit(absolute, true);
      if (entry.isFile() && SOURCE_EXTENSIONS.test(entry.name)) {
        sources.push({ filename: path.relative(repoRoot, absolute).split(path.sep).join('/'), text: await readFile(absolute, 'utf8') });
      }
    }
  }
  await visit(path.join(repoRoot, 'webapp/src'), true);
  // Standalone games are top-level public scripts/HTML. Generated and vendored
  // public trees are handled by their source/dependency inventories instead.
  await visit(path.join(repoRoot, 'webapp/public'), false);
  return sources;
}

export function githubCoordinates(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  let match;
  if (url.hostname === 'raw.githubusercontent.com') {
    match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
  } else if (['cdn.jsdelivr.net', 'fastly.jsdelivr.net'].includes(url.hostname)) {
    match = url.pathname.match(/^\/gh\/([^/]+)\/([^@/]+)@([^/]+)\/(.+)$/);
  } else if (url.hostname === 'cdn.statically.io') {
    match = url.pathname.match(/^\/gh\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
  } else if (url.hostname === 'github.com') {
    match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/(?:raw|blob)\/([^/]+)\/(.+)$/);
  }
  if (!match) return null;
  return { owner: match[1], repo: match[2], ref: match[3], assetPath: match[4] };
}

/** Mirrors of precisely one repository/ref/path, never another model. */
export function githubAssetCandidates({ owner, repo, ref, assetPath }) {
  return [
    `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${assetPath}`,
    `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${assetPath}`,
    `https://fastly.jsdelivr.net/gh/${owner}/${repo}@${ref}/${assetPath}`,
    `https://cdn.statically.io/gh/${owner}/${repo}/${ref}/${assetPath}`
  ];
}

const stableId = (kind, value) => `${kind}-${value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(-90)}-${createHash('sha256').update(value).digest('hex').slice(0, 10)}`;

/**
 * Expand the finite model/thumbnail URL constructors used by the game code.
 * The general source inventory owns literal URLs; GitHub model literals are
 * revisited here only to include mirrors constructed by the runtime loaders.
 * A group contains equivalent source URLs, not merely visual fallbacks.
 */
export async function collectModelInventory({ repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const sources = await runtimeSources(repoRoot);
  const excludeWeaponKart = await shouldExcludeWeaponKartGame({ repoRoot });
  const groups = new Map();
  const add = (id, candidates, aliases = candidates) => {
    const previous = groups.get(id);
    groups.set(id, {
      id,
      candidates: [...new Set([...(previous?.candidates || []), ...candidates])],
      aliases: [...new Set([...(previous?.aliases || []), ...aliases])]
    });
  };
  const addGithub = coordinates => {
    const key = `${coordinates.owner}/${coordinates.repo}@${coordinates.ref}/${coordinates.assetPath}`;
    const candidates = githubAssetCandidates(coordinates);
    add(stableId('github', key), candidates);
  };

  for (const { filename, text } of sources) {
    if (excludeWeaponKart && filename === 'webapp/src/components/WeaponKartGame.jsx') continue;
    if (filename === 'webapp/src/games/tiranastreets/shared/importedAssets.mjs') {
      // Tirana loads localUrl when present. Its urls[] records then contain
      // inactive historical folder guesses, rather than runtime fallbacks.
      // Keep the chosen original sources; verified local assets cover the bytes.
      const serialized = text.match(/export const IMPORTED_ASSETS\s*=\s*(\[[\s\S]*?\n\]);/)?.[1];
      if (!serialized) throw new Error('Cannot read Tirana original asset provenance.');
      const assets = JSON.parse(serialized);
      if (assets.every((asset) => asset.localUrl && asset.sourceUrl)) {
        for (const asset of assets) {
          const coordinates = githubCoordinates(asset.sourceUrl);
          if (coordinates) addGithub(coordinates);
        }
        continue;
      }
    }
    // Recover only these known original avatars from their attributed archive.
    // Each avatar is a distinct group; failed provider endpoints become aliases
    // of that same ID, never another available character.
    for (const match of text.matchAll(/https:\/\/(?:(?:models|avatars)\.readyplayer\.me\/|api\.readyplayer\.me\/v1\/avatars\/)([a-f0-9]{24})\.glb/g)) {
      const id = match[1];
      if (!READY_PLAYER_ME_ARCHIVE_IDS.has(id)) continue;
      const candidates = githubAssetCandidates({
        owner: 'digitalworlds', repo: 'UPose', ref: READY_PLAYER_ME_ARCHIVE_REF,
        assetPath: `UPose/Assets/StreamingAssets/${id}.glb`
      });
      add(`ready-player-me-${id}`, candidates, [
        ...candidates,
        `https://models.readyplayer.me/${id}.glb`,
        `https://api.readyplayer.me/v1/avatars/${id}.glb`,
        `https://avatars.readyplayer.me/${id}.glb`
      ]);
    }
    // Poly Pizza helpers accept UUIDs rather than complete source URLs.
    for (const match of text.matchAll(new RegExp(`\\b(?:polyGlb|polyWeapon|polyWebp)\\(\\s*['"](${UUID})['"]`, 'gi'))) {
      const extension = match[0].startsWith('polyWebp') ? 'webp' : 'glb';
      add(`poly-pizza-${match[1]}-${extension}`, [`https://static.poly.pizza/${match[1]}.${extension}`]);
    }
    for (const match of text.matchAll(new RegExp(`\\bpolyPizzaWeapon\\(\\s*['"][^'"]+['"]\\s*,\\s*['"][^'"]+['"]\\s*,\\s*['"](${UUID})['"]`, 'gi'))) {
      for (const extension of ['glb', 'webp']) {
        add(`poly-pizza-${match[1]}-${extension}`, [`https://static.poly.pizza/${match[1]}.${extension}`]);
      }
    }

    // Store previews and clearcoat model constructors use Khronos model names.
    for (const match of text.matchAll(/\bkhronosThumb\(\s*['"]([^'"]+)['"]/g)) {
      addGithub({ owner: 'KhronosGroup', repo: 'glTF-Sample-Assets', ref: 'main', assetPath: `Models/${match[1]}/screenshot/screenshot.jpg` });
    }
    for (const match of text.matchAll(/\bcreateKhronosGltfUrls\(\s*['"]([^'"]+)['"]/g)) {
      addGithub({ owner: 'KhronosGroup', repo: 'glTF-Sample-Assets', ref: 'main', assetPath: `Models/${match[1]}/glTF-Binary/${match[1]}.glb` });
    }

    // Gunify's authored textures live alongside each scene.gltf; the downloader
    // must recursively collect its buffers/images at this exact pinned ref.
    const ref = text.match(/(?:SNAKE_)?GUNIFY_MAY_9_REF\s*=\s*['"]([^'"]+)['"]/)?.[1];
    if (ref) {
      const names = new Set([
        ...[...text.matchAll(/\bgunifyModelUrls\(\s*['"]([^'"]+)['"]/g)].map(match => match[1]),
        ...[...text.matchAll(/\bgunifyWeapon\(\s*['"][^'"]+['"]\s*,\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]/g)].map(match => match[1]),
        ...[...text.matchAll(/\bsnakeMatchedGunifyCaptureConfig\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]/g)].map(match => match[1])
      ]);
      const folderOverrides = new Map([...text.matchAll(/\b([A-Za-z][A-Za-z0-9]*)\s*:\s*['"](models\d+)['"]/g)].map(match => [match[1], match[2]]));
      for (const name of names) {
        addGithub({ owner: 'KrishBharadwaj5678', repo: 'Gunify', ref, assetPath: `${folderOverrides.get(name) || 'models'}/${name}/scene.gltf` });
      }
    }
    if (text.includes('const gunifyImage')) {
      for (const match of text.matchAll(/\bgunifyImage\(\s*['"]([^'"]+)['"]/g)) {
        addGithub({ owner: 'KrishBharadwaj5678', repo: 'Gunify', ref: 'main', assetPath: `images/${match[1]}` });
      }
    }

    // SDRangel filenames are appended to a runtime array of mirror roots.
    if (text.includes('srcejon/sdrangel-3d-models')) {
      for (const match of text.matchAll(/\b(?:SNAKE_)?CAPTURE_VEHICLE_MODEL_FILES\s*=\s*(?:Object\.freeze\()?\{([\s\S]*?)\n\}\)?;/g)) {
        for (const file of match[1].matchAll(/['"]([^'"/]+\.glb)['"]/g)) {
          addGithub({ owner: 'srcejon', repo: 'sdrangel-3d-models', ref: 'main', assetPath: file[1] });
        }
      }
      for (const match of text.matchAll(/\bsnakeSharedCaptureVehicleUrls\(\s*['"]([^'"]+)['"]/g)) {
        addGithub({ owner: 'srcejon', repo: 'sdrangel-3d-models', ref: 'main', assetPath: match[1] });
      }
    }

    // Human/vehicle loaders create mirrors for literal GitHub model entries.
    for (const match of text.matchAll(/['"`](https?:\/\/[^'"`\s]+)['"`]/g)) {
      if (match[1].includes('${') || !MODEL_EXTENSION.test(match[1])) continue;
      const coordinates = githubCoordinates(match[1]);
      if (coordinates) {
        addGithub(coordinates);
        const key = `${coordinates.owner}/${coordinates.repo}@${coordinates.ref}/${coordinates.assetPath}`;
        add(stableId('github', key), [], [match[1]]);
      }
    }
  }

  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export default collectModelInventory;

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const groups = await collectModelInventory({ repoRoot: process.argv[2] || DEFAULT_REPO_ROOT });
  process.stdout.write(`${JSON.stringify(groups, null, 2)}\n`);
}
