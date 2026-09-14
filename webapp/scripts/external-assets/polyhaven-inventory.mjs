import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as pool from '../../src/config/poolRoyaleInventoryConfig.js';
import * as snooker from '../../src/config/snookerRoyalInventoryConfig.js';
import * as texas from '../../src/config/texasHoldemInventoryConfig.js';
import * as airHockey from '../../src/config/airHockeyInventoryConfig.js';
import * as murlan from '../../src/config/murlanThemes.js';
import * as domino from '../../src/config/dominoRoyalThemeCatalog.js';
import { POOL_ROYALE_CLOTH_VARIANTS } from '../../src/config/poolRoyaleClothPresets.js';
import { TABLE_CLOTH_OPTIONS } from '../../src/utils/tableCustomizationOptions.js';
import { WOOD_GRAIN_OPTIONS } from '../../src/utils/woodMaterials.js';
import { polyHavenThumb } from '../../src/config/storeThumbnails.js';

const WEBAPP = fileURLToPath(new URL('../../', import.meta.url));
const DOWNLOAD = 'https://dl.polyhaven.org/file/ph-assets';
const API = 'https://api.polyhaven.com/files/';
const RESOLUTIONS = ['1k', '2k', '4k', '8k'];
const CHANNELS = { diffuse: 'diff', normal: 'nor_gl', roughness: 'rough' };
const LEGACY_CHANNELS = { diffuse: 'Color', normal: 'NormalGL', roughness: 'Roughness' };
const unique = values => [...new Set(values.filter(Boolean))];
// Verified against https://api.polyhaven.com/assets on 2026-09-14. These
// published identifiers are case-sensitive; their lowercase forms are absent.
const CASE_SENSITIVE_MODELS = ['ArmChair_01', 'BarberShopChair_01', 'CoffeeTable_01', 'GreenChair_01', 'SchoolChair_01'];

// These are visual tint variants, not distinct scans. Their descriptions and
// existing thumbnail aliases identify the original material unambiguously.
export function canonicalPolyhavenId(value) {
  const id = String(value || '').trim();
  if (/^caban(?:Blue|Green|Beige|DarkGrey)-/i.test(id)) return 'caban';
  if (/^polar_fleece_(?:ocean|nature)_/.test(id)) return 'polar_fleece';
  if (id === 'rosewood_veneer_01') return 'rosewood_veneer1';
  const exactModel = CASE_SENSITIVE_MODELS.find(candidate => candidate.toLowerCase() === id.toLowerCase());
  if (exactModel) return exactModel;
  // Both spellings are published, distinct models by different authors. The
  // shared-theme model identifier must not inherit the thumbnail's old alias.
  if (id === 'WoodenTable_02') return id;
  // The catalog label "Countrytrack Midday" is a spelling error for the only
  // published Countrytrax Midday environment, matching its countryside/noon
  // description. The old country_track_midday identifier is not published.
  if (id === 'country_track_midday') return 'countrytrax_midday';
  return id.toLowerCase();
}

const textureUrl = (id, resolution, channel, extension = 'jpg') =>
  `${DOWNLOAD}/Textures/${extension}/${resolution}/${id}/${id}_${CHANNELS[channel]}_${resolution}.${extension}`;
const legacyTextureUrl = (id, resolution, channel) =>
  `${DOWNLOAD}/Textures/jpg/${resolution}/${id}/${id}_${resolution.toUpperCase()}_${LEGACY_CHANNELS[channel]}.jpg`;
const modelUrl = (id, resolution) => `${DOWNLOAD}/Models/gltf/${resolution}/${id}/${id}_${resolution}.gltf`;

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'vendor' || entry.name === 'node_modules') continue;
    if (entry.name === 'external' && directory.endsWith(path.join('public', 'assets'))) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(filename));
    else if (/\.(?:js|jsx|ts|tsx|html)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name)) files.push(filename);
  }
  return files.sort();
}

/** No network requests, DOM setup or game-module execution is needed. */
export async function buildPolyhavenInventory({ webappDir = WEBAPP } = {}) {
  const groups = new Map();
  const metadata = new Map();
  const add = entry => {
    const existing = groups.get(entry.id);
    groups.set(entry.id, {
      ...existing, ...entry,
      candidates: unique([...(existing?.candidates || []), ...(entry.candidates || [])]),
      aliases: unique([...(existing?.aliases || []), ...(entry.aliases || [])]),
      sources: unique([...(existing?.sources || []), ...(entry.sources || [])]).sort()
    });
    return entry.id;
  };
  const trackMetadata = (rawId, groupId) => {
    const assetId = canonicalPolyhavenId(rawId);
    const request = metadata.get(assetId) || { url: `${API}${encodeURIComponent(assetId)}`, assetId, aliases: [], groupIds: [] };
    request.aliases = unique([...request.aliases, `${API}${encodeURIComponent(rawId)}`,
      CASE_SENSITIVE_MODELS.includes(assetId) ? `${API}${assetId.toLowerCase()}` : null]).filter(url => url !== request.url);
    request.groupIds = unique([...request.groupIds, groupId]);
    metadata.set(assetId, request);
  };
  const addTexture = (rawId, resolutions, source, channels = Object.keys(CHANNELS)) => {
    const assetId = canonicalPolyhavenId(rawId);
    for (const resolution of resolutions) for (const channel of channels) {
      const canonical = textureUrl(assetId, resolution, channel);
      const id = `polyhaven:texture:${assetId}:${resolution}:${channel}`;
      const candidates = [canonical];
      if (assetId === 'fabric_pattern_07' && channel === 'diffuse') candidates.unshift(canonical.replace('_diff_', '_col_1_'));
      // These assets publish two color variants. Their own glTF include maps use
      // coll1 for the default red leather; coll2 is a different finish.
      if (/^leather_red_0[23]$/.test(assetId) && channel === 'diffuse') candidates.unshift(canonical.replace('_diff_', '_coll1_'));
      add({ id, kind: 'texture', assetId, resolution, channel, essential: true, candidates,
        aliases: unique([textureUrl(rawId, resolution, channel), legacyTextureUrl(rawId, resolution, channel),
          legacyTextureUrl(assetId, resolution, channel)]).filter(url => !candidates.includes(url)), sources: [source] });
      trackMetadata(rawId, id);
    }
  };
  const addModel = (rawId, resolutions, source) => {
    const assetId = canonicalPolyhavenId(rawId);
    for (const resolution of resolutions) {
      const id = `polyhaven:model:${assetId}:${resolution}`;
      add({ id, kind: 'model', assetId, resolution, essential: true, recursive: true,
        candidates: unique([modelUrl(rawId, resolution), modelUrl(assetId, resolution)]),
        aliases: CASE_SENSITIVE_MODELS.includes(assetId) ? [modelUrl(assetId.toLowerCase(), resolution)] : [], sources: [source] });
      trackMetadata(rawId, id);
    }
  };
  const addHdri = (option, resolutions, source) => {
    const assetId = canonicalPolyhavenId(option.assetId);
    for (const resolution of unique(resolutions)) {
      for (const format of ['hdr', 'exr']) {
        const id = `polyhaven:hdri:${assetId}:${resolution}${format === 'hdr' ? '' : ':exr'}`;
        const candidates = unique([option.assetUrls?.[resolution]?.endsWith(`.${format}`) ? option.assetUrls[resolution] : null,
          `${DOWNLOAD}/HDRIs/${format}/${resolution}/${assetId}_${resolution}.${format}`]);
        add({ id, kind: 'hdri', assetId, resolution, format, essential: format === 'hdr',
          candidates, aliases: [`${DOWNLOAD}/HDRIs/${format}/${resolution}/${option.assetId}_${resolution}.${format}`].filter(url => !candidates.includes(url)),
          sources: [source], ...(format === 'exr' ? { reason: 'Format-specific EXR fallback after HDR; decoded with EXRLoader, never interchangeable HDR bytes.' } : {}) });
        trackMetadata(option.assetId, id);
      }
    }
  };

  // Pool's catalog is also used by Snake, Chess, Ludo, Checkers, Four in Row,
  // Tavull and Murlan. Murlan/Pool frame-rate profiles and Texas lobby preloading
  // select all four resolutions; include them without adding unsupported 16k.
  for (const option of pool.POOL_ROYALE_HDRI_VARIANTS) addHdri(option, RESOLUTIONS, 'shared game HDRI catalog / adaptive quality');
  for (const option of texas.TEXAS_HDRI_OPTIONS) addHdri(option, RESOLUTIONS, 'Texas HDRI options / lobby preload');
  for (const option of snooker.SNOOKER_ROYALE_HDRI_VARIANTS) addHdri(option, option.preferredResolutions || ['4k'], 'Snooker HDRI catalog');
  for (const option of airHockey.AIR_HOCKEY_CUSTOMIZATION.environmentHdri) addHdri(option, option.preferredResolutions || ['4k'], 'Air Hockey HDRI catalog');

  for (const option of [...murlan.MURLAN_STOOL_THEMES, ...murlan.MURLAN_TABLE_THEMES,
    ...domino.DOMINO_ROYAL_CHAIR_THEMES, ...domino.DOMINO_ROYAL_TABLE_THEMES]) {
    if (option.source === 'polyhaven' && option.assetId) addModel(option.assetId, ['1k', '2k'], 'shared selectable chairs and tables');
  }
  for (const option of TABLE_CLOTH_OPTIONS) if (option.sourceId) addTexture(option.sourceId, RESOLUTIONS, 'shared table cloth / Murlan quality profiles');
  for (const option of POOL_ROYALE_CLOTH_VARIANTS) addTexture(option.sourceId, RESOLUTIONS, 'Pool and Snooker tinted caban cloth');

  const addExplicit = (url, source) => {
    if (!/^https:\/\/[^/]*polyhaven\.(?:org|com)\//i.test(url) || /\$\{|[{}]/.test(url)) return;
    let match;
    if ((match = url.match(/\/Textures\/(?:jpg|png)\/(\dk)\/([^/]+)\//i))) {
      const [, resolution, rawId] = match;
      const filename = new URL(url).pathname.split('/').at(-1);
      const channel = /nor|normal/i.test(filename) ? 'normal' : /rough/i.test(filename) ? 'roughness' : /diff|albedo|basecolor|_col_|_Color/i.test(filename) ? 'diffuse' : null;
      // These old ambientCG-style identifiers were incorrectly assigned a Poly
      // Haven host. Preserve them as explicit optional diagnostics, not fictional
      // canonical scans or requirements that can never finish downloading.
      if (/^(?:Wood|Marble)\d+$/i.test(rawId)) {
        add({ id: `polyhaven:legacy:${rawId}:${resolution}:${channel || filename}`, kind: 'legacy-fallback', assetId: rawId,
          resolution, channel, essential: false, candidates: [url], aliases: [], sources: [source],
          reason: 'Absent from official Poly Haven asset catalog; ChessBattleRoyal loadTexture() catches failure and returns createFallbackTexture(fallbackColor), retaining its configured material colors.' });
      } else if (channel) {
        addTexture(rawId, [resolution], source, [channel]);
        const id = `polyhaven:texture:${canonicalPolyhavenId(rawId)}:${resolution}:${channel}`;
        const entry = groups.get(id);
        entry.candidates = unique([url, ...entry.candidates]);
      }
      return;
    }
    if ((match = url.match(/\/Textures\/gltf\/(\dk)\/([^/]+)\//i))) {
      const [, resolution, rawId] = match;
      const assetId = canonicalPolyhavenId(rawId);
      const id = `polyhaven:material:${assetId}:${resolution}`;
      add({ id, kind: 'model', assetId, resolution, essential: true, recursive: true,
        candidates: [url], aliases: [], sources: [source] });
      // Material sample glTFs have the same authoritative include maps as
      // scanned models, including shared-resolution bins and separate maps.
      trackMetadata(rawId, id);
      return;
    }
    if ((match = url.match(/\/Models\/gltf\/(\dk)\/([^/]+)\//i))) {
      addModel(match[2], [match[1]], source);
      return;
    }
    if ((match = url.match(/\/HDRIs\/(?:hdr|exr)\/(\dk)\/([^/]+)_\dk\.(hdr|exr)/i))) {
      addHdri({ assetId: match[2] }, [match[1]], source);
      if (match[3].toLowerCase() === 'exr') groups.get(`polyhaven:hdri:${canonicalPolyhavenId(match[2])}:${match[1]}:exr`).essential = true;
      return;
    }
    if ((match = url.match(/\/thumbs\/([^/?]+)\.png/i))) {
      const assetId = canonicalPolyhavenId(match[1]);
      const canonicalUrl = url.replace(`/thumbs/${match[1]}.png`, `/thumbs/${assetId}.png`);
      add({ id: `polyhaven:thumbnail:${canonicalUrl}`, kind: 'thumbnail', assetId, essential: true,
        candidates: [canonicalUrl], aliases: url === canonicalUrl ? [] : [url], sources: [source] });
      return;
    }
    if (/\.(?:png|jpe?g|hdr|exr|glb|gltf)(?:\?|$)/i.test(url)) {
      const kind = /\/thumbs\//.test(url) ? 'thumbnail' : /\.gltf(?:\?|$)/.test(url) ? 'model' : 'image';
      add({ id: `polyhaven:${kind}:${url}`, kind, essential: true, candidates: [url], aliases: [], sources: [source], recursive: kind === 'model' });
    }
  };
  const visit = (value, source, seen = new Set()) => {
    if (typeof value === 'string') { addExplicit(value, source); return; }
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const child of Object.values(value)) visit(child, source, seen);
  };
  for (const [name, catalog] of Object.entries({ pool, snooker, texas, airHockey, murlan, domino, wood: WOOD_GRAIN_OPTIONS, cloth: TABLE_CLOTH_OPTIONS })) visit(catalog, `catalog:${name}`);

  // Discover literal URLs and the small runtime-owned collections which are
  // deliberately not imported: importing scene JSX would require a browser.
  const files = [...await sourceFiles(path.join(webappDir, 'src')), ...await sourceFiles(path.join(webappDir, 'public'))];
  for (const filename of files) {
    const source = path.relative(webappDir, filename).split(path.sep).join('/');
    let text = await readFile(filename, 'utf8');
    if (!/polyhaven/i.test(text)) continue;
    // These two obsolete Snake catalogs are never consumed. Do not require
    // their placeholder thumbnails; resume discovery automatically if either
    // constant becomes referenced by the game in a later change.
    if (source.endsWith('/SnakeAndLadder.jsx')) {
      for (const name of ['FLOOR_TEXTURE_OPTIONS', 'WALL_TEXTURE_OPTIONS']) {
        if ([...text.matchAll(new RegExp(`\\b${name}\\b`, 'g'))].length === 1) {
          text = text.replace(new RegExp(`const ${name}\\s*=\\s*Object\\.freeze\\(\\[[\\s\\S]*?\\n\\]\\);`), '');
        }
      }
    }
    for (const match of text.matchAll(/https?:\/\/[^\s'"`<>\\]+/g)) addExplicit(match[0], source);
    for (const match of text.matchAll(/polyHavenThumb\(\s*['"]([^'"]+)['"]/g)) addExplicit(polyHavenThumb(match[1]), source);
    if (source === 'public/domino-royal-game.js') {
      // The standalone game owns a separate 512px thumbnail constructor; these
      // query strings identify different image bytes from the shared 256px UI.
      const ids = new Set();
      const chairs = text.match(/const MURLAN_POLYHAVEN_CHAIR_THEMES\s*=\s*\[([\s\S]*?)\n\]\.map/);
      const tables = text.match(/const MURLAN_TABLE_THEMES\s*=\s*Object\.freeze\(\s*\[([\s\S]*?)\n\s*\]\.map/);
      const environments = text.match(/const POOL_ROYALE_HDRI_VARIANTS\s*=\s*Object\.freeze\(\[([\s\S]*?)\n\]\);/);
      const wood = text.match(/function makeTableWoodOption\([\s\S]*?thumbnail:\s*POLYHAVEN_THUMB\(([\s\S]*?)\n\s*\)/);
      for (const block of [chairs?.[1], environments?.[1]]) {
        for (const match of (block || '').matchAll(/assetId:\s*['"]([^'"]+)['"]/g)) ids.add(match[1]);
      }
      for (const match of (tables?.[1] || '').matchAll(/\bid:\s*['"]([^'"]+)['"]/g)) {
        if (match[1] !== 'murlan-default') ids.add(match[1]);
      }
      for (const match of (wood?.[1] || '').matchAll(/[?:]\s*['"]([^'"]+)['"]/g)) ids.add(match[1]);
      for (const match of text.matchAll(/POLYHAVEN_THUMB\(\s*['"]([^'"]+)['"]/g)) ids.add(match[1]);
      for (const id of ids) addExplicit(`https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=512&height=512`, source);
    }

    for (const match of text.matchAll(/makePolyhavenTextureMaterial\(\s*['"]([^'"]+)['"]/g)) addTexture(match[1], ['1k'], source);
    for (const match of text.matchAll(/(?:buildPolyhavenModelUrls|createPolyHavenGltfUrls|createPolyhavenTableBaseBuilder)\(\s*['"]([^'"]+)['"]/g)) addModel(match[1], ['1k', '2k'], source);
    if (source.endsWith('/humanRigCore.js')) {
      for (const match of text.matchAll(/\basset:\s*['"]([^'"]+)['"]/g)) addTexture(match[1], ['1k'], source);
    }
    const profiles = text.match(/const SEATED_HUMAN_TEXTURE_PROFILES\s*=\s*Object\.freeze\(\{([\s\S]*?)\n\}\);/);
    if (profiles) for (const match of profiles[1].matchAll(/(?:cloth|shoes|accessory):\s*['"]([^'"]+)['"]/g)) addTexture(match[1], ['1k', '2k'], source);
  }
  for (const id of ['rusty_metal_sheet', 'green_metal_rust']) addTexture(id, ['1k', '2k', '4k'], 'Snake / Ludo / Chess capture models');
  addTexture('marble_01', ['1k', '2k', '4k'], 'GamesHallway floor');
  addTexture('fabric_leather_02', ['4k'], 'Pool / Snooker pocket liners');
  for (const id of ['potted_plant_01', 'potted_plant_02', 'potted_plant_04']) {
    addModel(id, ['1k', '2k'], 'GamesHallway plants');
    addTexture(id, ['1k', '2k', '4k'], 'GamesHallway separately loaded plant textures');
  }

  const orderedGroups = [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
  const metadataRequests = [...metadata.values()].map(request => ({ ...request, aliases: request.aliases.sort(), groupIds: request.groupIds.sort() })).sort((a, b) => a.url.localeCompare(b.url));
  return { schemaVersion: 1, groups: orderedGroups, metadataRequests,
    summary: { groups: orderedGroups.length, essential: orderedGroups.filter(group => group.essential).length,
      metadataRequests: metadataRequests.length, byKind: orderedGroups.reduce((counts, group) => ({ ...counts, [group.kind]: (counts[group.kind] || 0) + 1 }), {}) } };
}

const HTTP = /^https?:\/\//i;
function collectUrls(value, parents = [], urls = []) {
  if (typeof value === 'string' && HTTP.test(value)) urls.push({ url: value, parents });
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) collectUrls(child, [...parents, key], urls);
  return urls;
}
const resolutionOf = ({ url, parents }) => url.match(/(?:_|\/)([1248]k)(?:[_.\/]|$)/i)?.[1]?.toLowerCase() || parents.find(key => /^[1248]k$/i.test(key))?.toLowerCase();
const channelMatches = (url, channel) => channel === 'diffuse' ? /diff|albedo|basecolor|_col(?:_|l?\d)/i.test(url) : channel === 'normal' ? /nor_gl|normal_gl|normalgl/i.test(url) : /rough/i.test(url);

/** Run once more with only successfully bundled source URLs before publishing
 * metadata. This prevents a recursive game picker selecting an unbundled HDR,
 * EXR, texture variant or alternate glTF from otherwise valid API metadata. */
export function filterPolyhavenMetadata(json, availableUrls) {
  const keep = new Set(availableUrls);
  const prune = value => {
    if (typeof value === 'string' && HTTP.test(value)) return keep.has(value) ? value : undefined;
    if (!value || typeof value !== 'object') return value;
    const result = Array.isArray(value) ? [] : {};
    for (const [key, child] of Object.entries(value)) {
      const next = prune(child);
      if (next !== undefined) { if (Array.isArray(result)) result.push(next); else result[key] = next; }
    }
    if (typeof value.url === 'string' && HTTP.test(value.url) && !result.url) return undefined;
    return Object.keys(result).length ? result : undefined;
  };
  return prune(json) || {};
}

/** Resolve real API filenames and retain only metadata for bundled resolutions.
 * The caller downloads dependencies too, rewrites all mapped URLs, then writes
 * body under request.url and its aliases. GLTF buffers/images still require
 * recursive download; Poly Haven include maps are also returned explicitly. */
export function resolvePolyhavenMetadata(request, json, inventoryGroups) {
  const declared = inventoryGroups.filter(group => request.groupIds.includes(group.id));
  const urls = collectUrls(json);
  const keep = new Set();
  const modelEntries = new Set();
  const allPublishedUrls = new Set(urls.map(entry => entry.url));
  const filenameOf = url => new URL(url).pathname.split('/').at(-1);
  const formatOf = url => filenameOf(url).split('.').at(-1).toLowerCase();
  const groups = declared.flatMap(group => {
    const found = unique(urls.filter(entry => resolutionOf(entry) === group.resolution && (
      group.kind === 'hdri' ? new RegExp(`\\.${group.format || 'hdr'}(?:[?#]|$)`, 'i').test(entry.url) :
        group.kind === 'model' ? /\.(?:gltf|glb)(?:[?#]|$)/i.test(entry.url) :
          /\.(?:jpg|jpeg|png)(?:[?#]|$)/i.test(entry.url) && channelMatches(entry.url, group.channel)
    )).map(entry => entry.url));
    const candidates = group.candidates || [];
    // A channel can contain different material parts and color variants. Its
    // URLs are not interchangeable. Honor the runtime's exact filename/format
    // first; a metadata-only picker otherwise prefers JPG in original API order.
    const exact = candidates.find(url => found.includes(url));
    const sameFilename = candidates.map(url => found.find(candidate => filenameOf(candidate) === filenameOf(url))).find(Boolean);
    const preferredFormat = candidates[0] && formatOf(candidates[0]);
    const selected = exact || sameFilename || found.find(url => formatOf(url) === preferredFormat) || found[0];
    if (!selected) return [group];
    const selectedFormat = formatOf(selected);
    const aliases = unique([...candidates, ...(group.aliases || [])]).filter(url =>
      url !== selected && !allPublishedUrls.has(url) && formatOf(url) === selectedFormat);
    const resolved = [{ ...group, candidates: [selected], aliases }];
    // If source code explicitly declares another real file, keep it independent
    // rather than aliasing its bytes to the first variant or raster format.
    for (const candidate of candidates) if (candidate !== selected && allPublishedUrls.has(candidate)) {
      resolved.push({ ...group, id: `${group.id}:declared:${encodeURIComponent(filenameOf(candidate))}`,
        candidates: [candidate], aliases: [] });
    }
    for (const entry of resolved) {
      const url = entry.candidates[0];
      keep.add(url);
      if (group.kind === 'model') modelEntries.add(url);
    }
    return resolved;
  });
  const dependencies = new Map();
  const trackDependency = (url, alias) => {
    const aliases = dependencies.get(url) || new Set();
    if (alias && alias !== url) aliases.add(alias);
    dependencies.set(url, aliases);
  };
  const findIncludes = value => {
    if (!value || typeof value !== 'object') return;
    if (modelEntries.has(value.url)) {
      for (const { url } of collectUrls(value)) { keep.add(url); if (url !== value.url) trackDependency(url); }
      // glTF references use these relative include keys, while the canonical
      // file can live under another format directory or a shared resolution.
      // The API provides the exact identity; do not guess a URL beside the glTF.
      for (const [relative, dependency] of Object.entries(value.include || {})) {
        if (typeof dependency?.url !== 'string' || !HTTP.test(dependency.url)) continue;
        trackDependency(dependency.url, new URL(relative, value.url).href);
      }
    }
    for (const child of Object.values(value)) findIncludes(child);
  };
  findIncludes(json);
  return { groups, body: filterPolyhavenMetadata(json, keep), dependencies: [...dependencies.keys()].sort().map(url => ({
    url, essential: true, aliases: [...dependencies.get(url)].sort()
  })) };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  buildPolyhavenInventory().then(inventory => console.log(JSON.stringify(inventory, null, 2))).catch(error => {
    console.error(error); process.exitCode = 1;
  });
}
