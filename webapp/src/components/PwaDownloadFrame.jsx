import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, CloudDownload, Pause, RefreshCw, Smartphone } from 'lucide-react';
import useAppDownload from '../hooks/useAppDownload.js';
import usePwaInstallPrompt from '../hooks/usePwaInstallPrompt.js';
import { formatBytes, GAME_PACK_STORAGE_ERROR_MESSAGE } from '../pwa/gamePackManager.js';
import gamesCatalog from '../config/gamesCatalog.js';

const STATUS_LABELS = {
  installed: 'All app files saved',
  'update-available': 'Update available',
  downloading: 'Downloading app files',
  partial: 'Download paused · resume anytime',
  'not-installed': 'App files not downloaded',
  unavailable: 'Download unavailable'
};

export default function PwaDownloadFrame() {
  const location = useLocation();
  const sectionRef = useRef(null);
  const [installMessage, setInstallMessage] = useState('');
  const [requestError, setRequestError] = useState('');
  const { pack, status, progress, storage, loading, error: cacheError, supported, download, cancel, refresh, remove } = useAppDownload();
  const error = requestError || cacheError;
  const {
    installed,
    installPending,
    canPrompt,
    requestInstall,
    installationGuidance,
    telegramDetected,
    openExternalInstall
  } = usePwaInstallPrompt();

  const downloading = status === 'downloading';
  const browserStorageLimited = error === GAME_PACK_STORAGE_ERROR_MESSAGE;
  const offerBrowserDownload = telegramDetected && browserStorageLimited;
  const filesReady = status === 'installed' || status === 'update-available';
  const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
  const totalBytes = progress?.totalBytes || pack?.totalBytes || 0;
  const savedBytes = Math.min(totalBytes, (progress?.downloadedBytes || 0) + (progress?.reusedBytes || 0));
  const pendingRoute = new URLSearchParams(location.search).get('returnTo');
  // Only return to local game URLs; never navigate to a URL supplied by another site.
  const safePendingRoute = pendingRoute?.startsWith('/games/') && !/[\\\r\n]/.test(pendingRoute) ? pendingRoute : null;
  const destination = safePendingRoute || '/games';
  const standaloneGame = gamesCatalog.some(game => game.standalone && game.route === destination.split(/[?#]/)[0]);

  useEffect(() => {
    if (location.hash === '#app-download') sectionRef.current?.scrollIntoView?.({ block: 'start' });
  }, [location.hash, location.key]);

  const addToHomeScreen = () => {
    // Keep this call in the click handler: browsers require a direct user gesture.
    const request = requestInstall();
    void Promise.resolve(request).then(result => {
      if (result?.outcome === 'dismissed') {
        setInstallMessage('You can add TonPlayGram to your Home Screen whenever you are ready.');
      } else if (result?.outcome === 'instructions' || result?.outcome === 'error') {
        setInstallMessage(result.instructions || installationGuidance);
      } else if (result?.outcome === 'accepted' || result?.outcome === 'requested') {
        setInstallMessage('Finish adding TonPlayGram on your device.');
      } else {
        setInstallMessage('');
      }
    }).catch(() => setInstallMessage(installationGuidance));
  };

  const startDownload = async () => {
    setRequestError('');
    if (!installed && !installPending) addToHomeScreen();
    try {
      await download();
    } catch (nextError) {
      setRequestError(nextError?.message || 'Unable to start the app download. Please try again.');
    }
  };

  const downloadLabel = error ? 'Retry download'
    : status === 'partial' ? 'Resume download'
      : status === 'update-available' ? 'Update TonPlayGram'
        : 'Download TonPlayGram';

  return (
    <section
      id="app-download"
      ref={sectionRef}
      aria-labelledby="app-download-title"
      className="relative scroll-mt-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#151a2b] via-[#101522] to-[#0b0f19] shadow-2xl shadow-black/30"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30">
            <CloudDownload size={25} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="app-download-title" className="text-xl font-bold text-white">TonPlayGram, one download</h2>
            <p className="mt-1 text-sm leading-5 text-slate-300">The whole app and every game, including textures, models and audio, saved to this device.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-300">
          {totalBytes > 0 && <span>{formatBytes(totalBytes)} total</span>}
          {pack?.assetCount > 0 && <span>{pack.assetCount.toLocaleString()} files</span>}
          {loading && !pack && <span>Checking app download…</span>}
        </div>
        {totalBytes > 1024 ** 3 && !filesReady && <p className="text-sm text-slate-300">Use Wi-Fi for this download.</p>}

        <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
          <div className="flex items-start gap-2" role="status" aria-live="polite">
            {filesReady ? <Check size={18} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" /> : <CloudDownload size={18} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />}
            <span className={filesReady ? 'text-emerald-300' : 'text-slate-200'}>
              {STATUS_LABELS[status] || 'App files not downloaded'}
              {downloading && ` · ${percent}%`}
            </span>
          </div>
          <div className="flex items-start gap-2 text-slate-300">
            <Smartphone size={18} className={`mt-0.5 shrink-0 ${installed ? 'text-emerald-400' : 'text-slate-400'}`} aria-hidden="true" />
            <span>{installed ? 'Added to Home Screen' : installPending ? 'Confirm the Home Screen installation on your device' : 'Home Screen installation not confirmed'}</span>
          </div>
          {(downloading || status === 'partial') && (
            <div className="space-y-2 pt-1">
              <div role="progressbar" aria-label="App download" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-300 transition-all" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-sm text-slate-400">
                {progress?.totalAssets > 0 ? `${progress.completedAssets || 0} of ${progress.totalAssets} files saved` : 'Preparing app files…'}
                {totalBytes > 0 && ` · ${formatBytes(savedBytes)} of ${formatBytes(totalBytes)}`}
              </p>
              {downloading && <p className="text-sm text-slate-400">Keep this app open until the download finishes.</p>}
            </div>
          )}
        </div>

        {!supported && <p className="text-sm leading-5 text-amber-200">Downloads are unavailable in this browser. Open TonPlayGram in Safari or Chrome to save the app.</p>}
        {error && <p role="alert" className="break-words text-sm leading-5 text-red-300">{error}</p>}

        {downloading ? (
          <button type="button" onClick={() => cancel()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/50 bg-primary/10 px-4 py-3 text-base font-semibold text-white">
            <Pause size={18} aria-hidden="true" /> Pause download
          </button>
        ) : status === 'installed' && !error ? (
          <Link to={destination} reloadDocument={standaloneGame} className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-base font-bold text-white">
            {safePendingRoute ? 'Return to game' : 'Play games'}
          </Link>
        ) : (
          <button type="button" onClick={startDownload} disabled={!supported || !pack || loading || status === 'unavailable'} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-base font-bold text-white transition active:scale-[0.98] disabled:opacity-50">
            <CloudDownload size={20} className="shrink-0" aria-hidden="true" /> {downloadLabel}
          </button>
        )}
        {status === 'update-available' && safePendingRoute && <Link to={destination} reloadDocument={standaloneGame} className="flex min-h-11 items-center justify-center text-sm font-semibold text-primary">Return to game</Link>}

        {offerBrowserDownload && (
          <div className="space-y-2">
            <button type="button" onClick={openExternalInstall} className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white">Open in browser to download</button>
            <p className="text-sm leading-5 text-slate-300">Chrome or Safari may have a different storage limit. Downloads are stored separately in each browser, so switching starts a separate download.</p>
          </div>
        )}

        {!installed && (
          <div className="space-y-2">
            <button type="button" onClick={addToHomeScreen} disabled={installPending} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              <Smartphone size={18} aria-hidden="true" /> {installPending ? 'Installation requested' : 'Add to Home Screen'}
            </button>
            {(installMessage || !canPrompt) && <p className="text-sm leading-5 text-slate-300">{installMessage || installationGuidance}</p>}
            {telegramDetected && !canPrompt && !offerBrowserDownload && <button type="button" onClick={openExternalInstall} className="min-h-11 text-left text-sm font-semibold text-primary">Open in browser to install</button>}
          </div>
        )}

        <p className="text-sm leading-5 text-slate-400">Saved files reduce repeat loading. Game performance depends on your device. Online matches, accounts and live content still need internet.</p>
        <details className="border-t border-white/10 pt-3 text-sm text-slate-400">
          <summary className="cursor-pointer py-1 text-slate-300">Download &amp; storage details</summary>
          <div className="space-y-2 pt-3">
            {storage?.quota > 0 && <p>Estimated browser storage for this app: {formatBytes(storage.usage)} used · {formatBytes(Math.max(0, storage.quota - storage.usage))} available.</p>}
            <p>{storage?.persisted ? 'Your browser has protected this app’s saved files from automatic cleanup.' : 'Your browser may clear saved files when storage is low. You can download them again here.'}</p>
            <button type="button" onClick={() => void refresh({ forceCatalog: true })} disabled={loading || downloading} className="flex min-h-11 items-center gap-2 font-semibold text-primary disabled:opacity-50">
              <RefreshCw size={16} aria-hidden="true" /> {loading ? 'Checking…' : 'Check for updates'}
            </button>
            {(filesReady || status === 'partial') && <button type="button" onClick={() => void remove()} disabled={downloading || loading} className="min-h-11 text-left text-red-300 disabled:opacity-50">Remove downloaded app files</button>}
          </div>
        </details>
      </div>
    </section>
  );
}
