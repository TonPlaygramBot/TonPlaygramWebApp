import { useMemo, useState } from 'react';
import { Download, PackageOpen, Rocket } from 'lucide-react';
import { cacheOfflineAssets, isTelegramEnvironment } from '../pwa/offlineCache.js';
import { cacheOpenSourceAssets } from '../pwa/openSourceCache.js';
import { APP_BUILD } from '../config/buildInfo.js';

const initialProgress = { completed: 0, total: 0, successes: 0, failures: 0 };

export default function PwaDownloadFrame() {
  const [offlineState, setOfflineState] = useState({ status: 'idle', progress: initialProgress, error: '' });
  const [openSourceState, setOpenSourceState] = useState({ status: 'idle', progress: initialProgress, error: '' });
  const [refreshState, setRefreshState] = useState({ status: 'idle', error: '' });

  const telegramLabel = useMemo(() => (isTelegramEnvironment() ? 'Telegram (in-app)' : 'Telegram'), []);

  const handleOfflineDownload = async (channel) => {
    setOfflineState({ status: 'loading', progress: initialProgress, error: '' });
    try {
      await cacheOfflineAssets({
        baseUrl: '/',
        onUpdate: (progress) => setOfflineState({ status: 'loading', progress, error: '' })
      });
      setOfflineState({ status: 'success', progress: initialProgress, error: '' });
      if (channel === 'telegram' && window.Telegram?.WebApp?.showPopup) {
        window.Telegram.WebApp.showPopup({
          title: 'TonPlaygram cached',
          message: 'Offline files are ready for Telegram WebView. Updates will install after your game ends.'
        });
      }
    } catch (err) {
      setOfflineState({
        status: 'error',
        progress: initialProgress,
        error: err?.message || 'Unable to cache the PWA files.'
      });
    }
  };

  const handleOpenSourceDownload = async () => {
    setOpenSourceState({ status: 'loading', progress: initialProgress, error: '' });
    try {
      await cacheOpenSourceAssets({
        onUpdate: (progress) => setOpenSourceState({ status: 'loading', progress, error: '' })
      });
      setOpenSourceState({ status: 'success', progress: initialProgress, error: '' });
    } catch (err) {
      setOpenSourceState({
        status: 'error',
        progress: initialProgress,
        error: err?.message || 'Unable to cache the open-source bundle.'
      });
    }
  };

  const handleRefreshToLatest = async () => {
    setRefreshState({ status: 'loading', error: '' });

    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service worker not supported in this browser.');
      }

      const registration = await navigator.serviceWorker.ready;
      await registration.update();

      const waitForInstall = registration.installing
        ? new Promise(resolve => {
            const worker = registration.installing;
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'installed' || worker.state === 'activated') {
                resolve();
              }
            });
          })
        : null;

      const targetWorker = registration.waiting || registration.installing;
      if (targetWorker) {
        targetWorker.postMessage({ type: 'SKIP_WAITING' });
      }

      if (waitForInstall) {
        await Promise.race([waitForInstall, new Promise(resolve => setTimeout(resolve, 1500))]);
      }

      const activeWorker = navigator.serviceWorker.controller || registration.active || registration.waiting;
      activeWorker?.postMessage({ type: 'CHECK_FOR_UPDATE' });

      setRefreshState({ status: 'success', error: '' });
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      setRefreshState({
        status: 'error',
        error: err?.message || 'Unable to refresh the PWA right now.'
      });
    }
  };

  const offlineHint = offlineState.status === 'loading'
    ? `Caching ${offlineState.progress.completed}/${offlineState.progress.total}`
    : offlineState.status === 'success'
      ? 'Cached and ready for offline play.'
      : 'Download the full PWA shell for faster load times.';

  const openSourceHint = openSourceState.status === 'loading'
    ? `Downloading ${openSourceState.progress.completed}/${openSourceState.progress.total}`
    : openSourceState.status === 'success'
      ? 'Open-source assets cached locally.'
      : 'Download open-source assets and code links for full transparency.';

  return (
    <div className="border border-border rounded-2xl bg-surface/90 p-4 space-y-4 shadow-xl shadow-black/20">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center">
          <Download className="text-primary" size={22} />
        </div>
        <div>
          <h3 className="text-white text-lg font-semibold">Download cached PWA</h3>
          <p className="text-sm text-subtext max-w-xl">
            Choose your browser to preload the full game shell. Updates are queued and applied after your match ends.
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-background/70 p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-white font-semibold">Latest home page version</p>
          <span className="text-xs text-subtext">Build {APP_BUILD || 'dev'}</span>
        </div>
        <button
          type="button"
          className="w-full bg-primary text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-primary/80 transition disabled:opacity-60"
          onClick={handleRefreshToLatest}
          disabled={refreshState.status === 'loading'}
        >
          {refreshState.status === 'loading' ? 'Updating…' : 'Update PWA to latest version'}
        </button>
        <p className="text-xs text-subtext">
          {refreshState.status === 'success'
            ? 'Latest version found. Reloading now...'
            : 'Force a quick update check to pull the newest home page and assets.'}
          {refreshState.status === 'error' && (
            <span className="text-red-400 block mt-1">{refreshState.error}</span>
          )}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/70 px-4 py-3 text-left hover:border-primary transition disabled:opacity-60"
          onClick={() => handleOfflineDownload('chrome')}
          disabled={offlineState.status === 'loading'}
        >
          <div>
            <p className="text-white font-semibold">Chrome PWA</p>
            <p className="text-xs text-subtext">Optimized for Chrome installs & desktop shortcuts.</p>
          </div>
          <Rocket className="text-primary" size={20} />
        </button>
        <button
          type="button"
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/70 px-4 py-3 text-left hover:border-primary transition disabled:opacity-60"
          onClick={() => handleOfflineDownload('telegram')}
          disabled={offlineState.status === 'loading'}
        >
          <div>
            <p className="text-white font-semibold">{telegramLabel} WebView</p>
            <p className="text-xs text-subtext">Preload for Telegram mobile browser sessions.</p>
          </div>
          <Rocket className="text-primary" size={20} />
        </button>
      </div>
      <div className="text-xs text-subtext">
        {offlineHint}
        {offlineState.status === 'error' && (
          <span className="text-red-400 block mt-1">{offlineState.error}</span>
        )}
      </div>
      <div className="pt-2 border-t border-border/60 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent/20 flex items-center justify-center">
            <PackageOpen className="text-accent" size={22} />
          </div>
          <div>
            <h4 className="text-white font-semibold">Open-source bundle</h4>
            <p className="text-sm text-subtext max-w-xl">
              Download every open-source package and asset reference we use so you can cache them locally.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="bg-accent text-white px-3 py-2 rounded-lg text-sm hover:bg-accent/80 transition disabled:opacity-60"
            onClick={handleOpenSourceDownload}
            disabled={openSourceState.status === 'loading'}
          >
            Cache open-source assets
          </button>
          <a
            href="/pwa/open-source-assets.json"
            download
            className="text-sm text-text/80 hover:text-white transition underline"
          >
            Download asset list
          </a>
          <a
            href="/pwa/open-source-sources.json"
            download
            className="text-sm text-text/80 hover:text-white transition underline"
          >
            Download package sources
          </a>
        </div>
        <div className="text-xs text-subtext">
          {openSourceHint}
          {openSourceState.status === 'error' && (
            <span className="text-red-400 block mt-1">{openSourceState.error}</span>
          )}
        </div>
      </div>
    </div>
  );
}
