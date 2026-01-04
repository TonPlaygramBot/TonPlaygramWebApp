import { Capacitor } from '@capacitor/core';
import { fetchLatestVersion, CURRENT_BUILD } from './versioning.js';

const TONPLAYGRAM_CACHE_PREFIX = 'tonplaygram-';

async function clearCaches() {
  if (typeof caches === 'undefined') return;
  try {
    const cacheNames = await caches.keys();
    const deletions = cacheNames
      .filter(name => name.startsWith(TONPLAYGRAM_CACHE_PREFIX))
      .map(name => caches.delete(name));
    await Promise.all(deletions);
  } catch (err) {
    console.warn('Unable to clear caches', err);
  }
}

async function unregisterServiceWorkers() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.getRegistrations) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
  } catch (err) {
    console.warn('Unable to unregister service workers', err);
  }
}

export async function refreshClientToLatestBuild() {
  await Promise.all([clearCaches(), unregisterServiceWorkers()]);

  const reload = () => {
    try {
      if (Capacitor?.isNativePlatform?.()) {
        // Force a full webview reload instead of history navigation
        window.location.href = window.location.href;
        return;
      }
      window.location.reload();
    } catch {
      window.location.href = '/';
    }
  };

  // Give the cache cleanup a moment to settle before reloading
  setTimeout(reload, 150);
}

export async function checkForNewBuild() {
  const latest = await fetchLatestVersion();
  if (!latest || !latest.build) {
    return { hasUpdate: false, latestBuild: null, source: latest?.source };
  }

  const latestBuild = String(latest.build);
  const hasUpdate = latestBuild !== CURRENT_BUILD;
  return { hasUpdate, latestBuild, source: latest.source };
}

