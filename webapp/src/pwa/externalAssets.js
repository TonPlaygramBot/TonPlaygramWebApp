import { FileLoader, ImageLoader } from 'three';

const NETWORK_FETCH = Symbol.for('tonplaygram.external-asset-fetch');
const LOADING_MANAGER_PATCH = Symbol.for('tonplaygram.external-asset-loader');
let cachedMap;
let localPaths = new Set();

// The generated map is loaded before the app shell. Keep URL resolution shared
// across Fetch and Three's image/model loaders, including custom managers.
export function resolveLocalAssetUrl(value, base = globalThis.location?.href) {
  if (typeof value !== 'string' || !base || /^(?:data|blob):/i.test(value)) return value;
  let url;
  try { url = new URL(value, base); } catch { return value; }
  const map = globalThis.__TONPLAYGRAM_EXTERNAL_ASSETS__ || {};
  if (map !== cachedMap) {
    cachedMap = map;
    localPaths = new Set(Object.values(map));
  }
  const local = map[url.href] || map[url.href.replace(/#.*$/, '')];
  if (local) {
    const resolved = new URL(local, globalThis.location.origin);
    if (url.hash) resolved.hash = url.hash;
    return resolved.href;
  }
  // glTF loaders can prepend a remote resource base to a root-relative URI.
  if (url.pathname.startsWith('/assets/external/') && localPaths.has(url.pathname)) {
    return new URL(url.pathname + url.hash, globalThis.location.origin).href;
  }
  return value;
}

export function installExternalAssetResolver() {
  if (typeof window === 'undefined') return;
  if (!window[NETWORK_FETCH] && typeof window.fetch === 'function') {
    const networkFetch = window.fetch.bind(window);
    window[NETWORK_FETCH] = networkFetch;
    window.fetch = (input, init) => {
      const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (method !== 'GET' && method !== 'HEAD') return networkFetch(input, init);
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (headers.has('authorization')) return networkFetch(input, init);
      const original = input instanceof Request ? input.url : String(input);
      const local = resolveLocalAssetUrl(original);
      if (local === original) return networkFetch(input, init);
      // Public asset bytes carry no authentication or account-specific state.
      if (input instanceof Request) {
        return networkFetch(new Request(local, input), init);
      }
      return networkFetch(local, init);
    };
  }
  for (const Loader of [FileLoader, ImageLoader]) {
    if (Loader.prototype[LOADING_MANAGER_PATCH]) continue;
    const originalLoad = Loader.prototype.load;
    Loader.prototype.load = function (...args) {
      const manager = this.manager;
      if (manager && !manager[LOADING_MANAGER_PATCH]) {
        const originalResolve = manager.resolveURL.bind(manager);
        manager.resolveURL = value => resolveLocalAssetUrl(originalResolve(resolveLocalAssetUrl(value)));
        manager[LOADING_MANAGER_PATCH] = true;
      }
      return originalLoad.apply(this, args);
    };
    Loader.prototype[LOADING_MANAGER_PATCH] = true;
  }
  for (const [Class, property] of [[window.HTMLImageElement, 'src'], [window.HTMLMediaElement, 'src'], [window.HTMLVideoElement, 'poster']]) {
    if (!Class) continue;
    const descriptor = Object.getOwnPropertyDescriptor(Class.prototype, property);
    if (!descriptor?.set || descriptor.set[LOADING_MANAGER_PATCH]) continue;
    const setter = function (value) { descriptor.set.call(this, resolveLocalAssetUrl(value)); };
    setter[LOADING_MANAGER_PATCH] = true;
    Object.defineProperty(Class.prototype, property, { ...descriptor, set: setter });
  }
  const setAttribute = window.Element?.prototype.setAttribute;
  if (setAttribute && !setAttribute[LOADING_MANAGER_PATCH]) {
    const mappedSetAttribute = function (name, value) {
      return setAttribute.call(this, name, /^(?:src|poster)$/i.test(name) ? resolveLocalAssetUrl(value) : value);
    };
    mappedSetAttribute[LOADING_MANAGER_PATCH] = true;
    window.Element.prototype.setAttribute = mappedSetAttribute;
  }
}
