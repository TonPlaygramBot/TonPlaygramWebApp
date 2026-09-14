let cachedMap;
let localPaths = new Set();

// The generated map is loaded before the app shell. Keep URL resolution shared
// across Fetch and Three's image/model loaders, including custom managers.
export function resolveLocalAssetUrl(value, base = globalThis.location?.href) {
  if (typeof value !== 'string' || !base || /^(?:data|blob):/i.test(value)) return value;
  let url;
  try { url = new URL(value, base); } catch { return value; }
  const appOrigin = globalThis.location?.origin || new URL(base).origin;
  const map = globalThis.__TONPLAYGRAM_EXTERNAL_ASSETS__ || {};
  if (map !== cachedMap) {
    cachedMap = map;
    localPaths = new Set(Object.values(map));
  }
  const local = map[url.href] || map[url.href.replace(/#.*$/, '')];
  if (local) {
    const resolved = new URL(local, appOrigin);
    if (url.hash) resolved.hash = url.hash;
    return resolved.href;
  }
  // glTF loaders can prepend a remote resource base to a root-relative URI.
  if (url.origin !== appOrigin && !url.search &&
      url.pathname.startsWith('/assets/external/') && localPaths.has(url.pathname)) {
    return new URL(url.pathname + url.hash, appOrigin).href;
  }
  return value;
}
