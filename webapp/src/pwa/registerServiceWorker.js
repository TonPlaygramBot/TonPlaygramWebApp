import { Capacitor } from '@capacitor/core';
import { APP_BUILD } from '../config/buildInfo.js';

let registrationPromise;
const SERVICE_WORKER_URL = `/service-worker.js?v=${encodeURIComponent(APP_BUILD)}`;

export async function registerTelegramServiceWorker() {
  if (typeof window === 'undefined' || !window.isSecureContext ||
      !navigator.serviceWorker || Capacitor.isNativePlatform()) return;
  if (registrationPromise) return registrationPromise;
  registrationPromise = (async () => {
    try {
      const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
        scope: '/', updateViaCache: 'none'
      });
      const check = () => registration.update().catch(() => {});
      const intervalId = setInterval(check, 5 * 60 * 1000);
      window.addEventListener('online', check);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('beforeunload', () => clearInterval(intervalId), { once: true });
      check();
      // A waiting worker stays waiting. Only an explicit home-card action activates
      // it and reloads; do not interrupt a match on controllerchange or tab focus.
      return registration;
    } catch (error) {
      console.error('Service worker registration failed', error);
      registrationPromise = undefined;
      return undefined;
    }
  })();
  return registrationPromise;
}
