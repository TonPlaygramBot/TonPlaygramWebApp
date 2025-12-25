const TELEGRAM_ONLY = true;
const REFRESH_FLAG_KEY = 'tonplaygram-sw-refreshed';

function safeSetSession(key, value) {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeGetSession(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function shouldRegisterForTelegram() {
  if (!('serviceWorker' in navigator)) return false;
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isLocalhost) return true;
  if (TELEGRAM_ONLY && !window.Telegram?.WebApp) return false;
  return true;
}

function markRefreshed() {
  safeSetSession(REFRESH_FLAG_KEY, '1');
}

function hasRefreshedAlready() {
  return safeGetSession(REFRESH_FLAG_KEY) === '1';
}

function forceReloadOnceReady() {
  if (hasRefreshedAlready()) return;
  markRefreshed();
  window.location.reload();
}

async function unregisterStaleServiceWorkers() {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker?.getRegistrations) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (!registrations.length) return;

    await Promise.all(registrations.map(reg => reg.unregister()));
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    } catch {
      // Cache cleanup is best-effort
    }

    if (navigator.serviceWorker.controller && !hasRefreshedAlready()) {
      markRefreshed();
      window.location.reload();
    }
  } catch (err) {
    console.warn('Service worker cleanup failed', err);
  }
}

function wireUpdateFlow(registration, shouldReload) {
  const pushToActive = worker => {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        worker.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  };

  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  if (registration.installing) {
    pushToActive(registration.installing);
  }

  registration.addEventListener('updatefound', () => {
    pushToActive(registration.installing);
  });

  if (shouldReload) {
    navigator.serviceWorker.addEventListener('controllerchange', forceReloadOnceReady);
  }
}

async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  try {
    const alreadyPersisted = await navigator.storage.persisted();
    if (!alreadyPersisted) {
      await navigator.storage.persist();
    }
  } catch (err) {
    // Persistence is best-effort; ignore errors
  }
}

export async function registerTelegramServiceWorker() {
  if (!shouldRegisterForTelegram()) {
    unregisterStaleServiceWorkers();
    return;
  }

  try {
    const hadController = Boolean(navigator.serviceWorker.controller);
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });

    wireUpdateFlow(registration, hadController);
    registration.update();
    requestPersistentStorage();

    // Refresh in-session to pick up any new build without prompting the user
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update();
      }
    });
  } catch (err) {
    console.error('Service worker registration failed', err);
  }
}
