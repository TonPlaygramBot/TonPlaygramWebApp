const TELEGRAM_ONLY = true;
const REFRESH_FLAG_KEY = 'tonplaygram-sw-refreshed';
const CACHE_OFFLINE_MESSAGE = { type: 'CACHE_OFFLINE_BUNDLE' };

function shouldRegisterForTelegram() {
  if (!('serviceWorker' in navigator)) return false;
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isLocalhost) return true;
  if (TELEGRAM_ONLY && !window.Telegram?.WebApp) return false;
  return true;
}

function markRefreshed() {
  sessionStorage.setItem(REFRESH_FLAG_KEY, '1');
}

function hasRefreshedAlready() {
  return sessionStorage.getItem(REFRESH_FLAG_KEY) === '1';
}

function forceReloadOnceReady() {
  if (hasRefreshedAlready()) return;
  markRefreshed();
  window.location.reload();
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

async function prewarmOfflineBundle() {
  try {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage(CACHE_OFFLINE_MESSAGE);
  } catch (err) {
    // Best-effort; ignore failures
  }
}

export async function registerTelegramServiceWorker() {
  if (!shouldRegisterForTelegram()) return;

  try {
    const hadController = Boolean(navigator.serviceWorker.controller);
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });

    wireUpdateFlow(registration, hadController);
    registration.update();
    requestPersistentStorage();
    prewarmOfflineBundle();
    navigator.serviceWorker.addEventListener('controllerchange', prewarmOfflineBundle);

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
