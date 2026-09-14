import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEBAPP = fileURLToPath(new URL('../', import.meta.url));
export async function readExternalAssetMap(root = WEBAPP) {
  try {
    const map = JSON.parse(await readFile(path.join(root, 'public/assets/external/url-map.json'), 'utf8'));
    // The existing Pool table probes this optional local import before its exact
    // CDN original. Point that probe at the verified bundled original as well.
    const showood = map['https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb'];
    if (showood) map['/models/pool-royale/showood-seven-foot/seven_foot_showood.glb'] = showood;
    return map;
  }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}

const compiledAssetMaps = new WeakMap();
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compileAssetMap(map) {
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
  const replacements = new Map();
  for (const [source, target] of entries) {
    replacements.set(source, target);
    replacements.set(source.replaceAll('/', '\\/'), target.replaceAll('/', '\\/'));
  }
  const literals = [...replacements.keys()].sort((a, b) => b.length - a.length);
  const matcher = literals.length ? new RegExp(literals.map(escapeRegExp).join('|'), 'g') : null;
  // Asset maps normally replace remote URLs with final local paths. Retain the
  // original ordered behavior for unusual maps that chain one target to another.
  const chained = matcher && [...replacements.values()].some(target => {
    matcher.lastIndex = 0;
    return matcher.test(target);
  });
  return { entries, replacements, matcher, chained };
}

export function replaceExternalAssetUrls(code, map) {
  let compiled = compiledAssetMaps.get(map);
  if (!compiled) {
    compiled = compileAssetMap(map);
    compiledAssetMaps.set(map, compiled);
  }
  const { entries, replacements, matcher, chained } = compiled;
  if (!matcher) return code;
  if (chained) {
    let output = code;
    for (const [source, target] of entries) {
      output = output.split(source).join(target);
      output = output.split(source.replaceAll('/', '\\/')).join(target.replaceAll('/', '\\/'));
    }
    return output;
  }
  // One scan per module instead of two scans for each of thousands of URLs.
  // Longest alternatives win at the same position, and callback replacements
  // keep literal dollar signs and other replacement metacharacters intact.
  matcher.lastIndex = 0;
  return code.replace(matcher, match => replacements.get(match));
}

export function localizeExternalAssetPlugin() {
  let map = {};
  return {
    name: 'tonplaygram-local-game-assets',
    enforce: 'pre',
    async buildStart() { map = await readExternalAssetMap(); },
    transform(code, id) {
      if (id.includes('node_modules') || !/\.[cm]?[jt]sx?(?:\?|$)/.test(id)) return null;
      const local = replaceExternalAssetUrls(code, map);
      return local === code ? null : { code: local, map: null };
    },
    transformIndexHtml(html) { return replaceExternalAssetUrls(html, map); }
  };
}

export async function localizeBuiltExternalAssets(distDir) {
  const map = await readExternalAssetMap();
  const walk = async directory => {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name);
      if (item.isDirectory()) {
        if (file === path.join(distDir, 'assets', 'external')) continue;
        await walk(file);
      } else if (/\.(?:html|css|js|json)$/i.test(item.name) &&
                 !file.includes(`${path.sep}pwa${path.sep}`) && item.name !== 'service-worker.js') {
        const original = await readFile(file, 'utf8');
        const result = replaceExternalAssetUrls(original, map);
        if (result !== original) await writeFile(file, result);
      }
    }
  };
  await walk(distDir);
}
