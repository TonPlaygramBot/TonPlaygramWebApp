import { useEffect } from 'react';

const SERVICE_WORKER_PATH = '/service-worker.js';
const UPDATE_INTERVAL_MS = 5 * 60 * 1000; // keep assets fresh for Telegram users

export default function usePwaUpdater() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return undefined;

    let updateInterval;
    let controllerChanged = false;

    const onControllerChange = () => {
      if (controllerChanged) return;
      controllerChanged = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const registerWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH, {
          scope: '/',
        });

        const requestUpdate = () => registration.update().catch(() => {});

        const trackInstalling = (worker) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        };

        trackInstalling(registration.installing);
        registration.addEventListener('updatefound', () => trackInstalling(registration.installing));

        await navigator.serviceWorker.ready;
        // Ensure the active session always pulls the latest build on login/open
        requestUpdate();

        const handleVisibility = () => {
          if (!document.hidden) requestUpdate();
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleVisibility);

        updateInterval = window.setInterval(requestUpdate, UPDATE_INTERVAL_MS);

        return () => {
          document.removeEventListener('visibilitychange', handleVisibility);
          window.removeEventListener('focus', handleVisibility);
        };
      } catch (err) {
        console.error('Service worker registration failed', err);
        return undefined;
      }
    };

    const cleanupPromise = registerWorker();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      if (updateInterval) window.clearInterval(updateInterval);
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, []);
}
