import { useCallback, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import useGamePacks from './useGamePacks.js';

export const APP_PACK_ID = 'tonplaygram-app';

async function waitForDownloadWorker() {
  if (Capacitor.isNativePlatform()) return;
  if (!navigator.serviceWorker) throw new Error('Open TonPlayGram in Chrome or Safari to download the app.');
  let timer;
  try {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('App storage is still starting. Reload this page and try again.')), 15000);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export default function useAppDownload() {
  const downloads = useGamePacks();
  const pack = useMemo(() => downloads.packs.find(item => item.id === APP_PACK_ID), [downloads.packs]);
  const supported = downloads.supported && (Capacitor.isNativePlatform() || Boolean(navigator.serviceWorker));
  const download = useCallback(async () => {
    await waitForDownloadWorker();
    if (!pack) throw new Error('The full app download is unavailable in this build. Check for an app update.');
    await downloads.install(APP_PACK_ID);
  }, [pack, downloads.install]);

  return {
    pack,
    status: pack?.status || 'unavailable',
    progress: pack?.progress,
    storage: downloads.storage,
    loading: downloads.loading,
    error: downloads.error || pack?.installation?.lastError || '',
    supported,
    download,
    cancel: () => downloads.cancel(APP_PACK_ID),
    refresh: downloads.refresh,
    remove: () => downloads.remove(APP_PACK_ID)
  };
}
