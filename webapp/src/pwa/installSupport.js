// Shared, framework-free installation helpers. Never put credentials in release requests.
export const ANDROID_RELEASE_API = 'https://api.github.com/repos/TonPlaygramBot/TonPlaygramWebApp/releases/latest';
const RELEASE_ROOT = 'https://github.com/TonPlaygramBot/TonPlaygramWebApp/releases/download/';

export function isTelegramEnvironment(scope = globalThis.window) {
  const app = scope?.Telegram?.WebApp;
  // Loading telegram-web-app.js also creates WebApp in ordinary browsers.
  return Boolean(app && (app.initData || ['android', 'android_x', 'ios', 'macos', 'tdesktop', 'weba', 'webk'].includes(app.platform)));
}

export function readStorage(key, storage) {
  try { return (storage || globalThis.window?.localStorage)?.getItem(key) ?? null; } catch { return null; }
}

export function writeStorage(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* Private browsing/storage denial must not break installation. */ }
}

export function withTimeout(promise, ms, message, signal) {
  return new Promise((resolve, reject) => {
    let timer;
    const finish = (fn, value) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      fn(value);
    };
    const onAbort = () => finish(reject, new DOMException('Cancelled', 'AbortError'));
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
    if (signal?.aborted) { onAbort(); return; }
    signal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => finish(reject, new Error(message)), ms);
  });
}

export async function waitForServiceWorker({ signal, timeoutMs = 12000 } = {}) {
  if (!globalThis.navigator?.serviceWorker || !globalThis.window?.isSecureContext) {
    throw new Error('Open TonPlaygram in a secure browser to use web caching.');
  }
  return withTimeout(navigator.serviceWorker.ready, timeoutMs,
    'Web caching is not ready. Reopen the app in your browser and try again.', signal);
}

export async function fetchWithDeadline(url, { signal, timeoutMs = 20000, consume, ...options } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    // Keep the deadline active while streaming/parsing/caching the response body.
    return consume ? await consume(response) : response;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export function parseAndroidRelease(release) {
  if (!release || release.draft || release.prerelease || !release.published_at) return null;
  const tag = /^android-v(\d+\.\d+\.\d+)-(\d+)$/.exec(release.tag_name || '');
  if (!tag || !Array.isArray(release.assets)) return null;
  const apk = release.assets.find(asset => asset.name === 'TonPlaygram.apk' && asset.state === 'uploaded' && asset.size > 0);
  const checksum = release.assets.find(asset => asset.name === 'TonPlaygram.apk.sha256' && asset.state === 'uploaded');
  const root = `${RELEASE_ROOT}${release.tag_name}/`;
  if (!apk || !checksum || apk.browser_download_url !== `${root}TonPlaygram.apk` ||
      checksum.browser_download_url !== `${root}TonPlaygram.apk.sha256`) return null;
  return {
    url: apk.browser_download_url,
    checksumUrl: checksum.browser_download_url,
    version: tag[1],
    versionCode: Number(tag[2]),
    size: apk.size
  };
}

export async function fetchAndroidRelease({ signal } = {}) {
  return fetchWithDeadline(ANDROID_RELEASE_API, {
    signal, timeoutMs: 10000, cache: 'no-store', credentials: 'omit',
    headers: { Accept: 'application/vnd.github+json' },
    consume: async response => {
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('The APK release could not be checked. Please try again.');
      return parseAndroidRelease(await response.json());
    }
  });
}

export function resolvePublicCacheAsset(asset, base) {
  if (typeof asset !== 'string' || !asset) return null;
  try {
    const url = new URL(asset.replace(/^\/(?!\/)/, ''), base);
    if (url.origin !== new URL(base).origin || url.search || url.hash || url.username || url.password) return null;
    if (/(^|\/)(api|auth|socket\.io|account|wallet)(\/|$)/i.test(decodeURIComponent(url.pathname))) return null;
    if (!/\.(?:html|js|mjs|css|json|webmanifest|wasm|png|jpe?g|webp|avif|svg|gif|ico|woff2?|ttf|mp3|ogg|wav|mp4|webm|glb|gltf|bin|ktx2|dds|hdr|exr|txt)$/i.test(url.pathname)) return null;
    if (url.pathname.split('/').some(part => decodeURIComponent(part).startsWith('.'))) return null;
    return url.href;
  } catch { return null; }
}

export async function checkForWebUpdate() {
  const registration = await waitForServiceWorker();
  await withTimeout(registration.update(), 15000, 'The update check timed out. Try again online.');
  const worker = registration.installing;
  if (worker && !['installed', 'activated', 'redundant'].includes(worker.state)) {
    let listener;
    try {
      await withTimeout(new Promise((resolve, reject) => {
        listener = () => {
          if (['installed', 'activated'].includes(worker.state)) resolve();
          if (worker.state === 'redundant') reject(new Error('The update did not install. Try again.'));
        };
        worker.addEventListener('statechange', listener);
        listener();
      }), 30000, 'The update is still downloading. Check again shortly.');
    } finally { worker.removeEventListener('statechange', listener); }
  }
  return registration;
}

export async function applyWaitingWebUpdate(registration) {
  if (readStorage('tonplaygram-game-active') === 'true') {
    throw new Error('Finish your current game before applying this update.');
  }
  if (!registration?.waiting) throw new Error('No update is ready yet. Check for updates first.');
  let listener;
  try {
    const changed = new Promise(resolve => {
      listener = () => resolve();
      navigator.serviceWorker.addEventListener('controllerchange', listener);
    });
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    await withTimeout(changed, 15000, 'The update has not activated. Please try again.');
    window.location.reload();
  } finally {
    navigator.serviceWorker.removeEventListener('controllerchange', listener);
  }
}
