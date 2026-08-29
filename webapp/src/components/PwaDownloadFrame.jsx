import { useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Chrome,
  CloudDownload,
  PackageOpen,
  RefreshCw,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { cacheOfflineAssets, isTelegramEnvironment } from '../pwa/offlineCache.js';
import { cacheOpenSourceAssets } from '../pwa/openSourceCache.js';
import { APP_BUILD } from '../config/buildInfo.js';

const initialProgress = { completed: 0, total: 0, successes: 0, failures: 0 };

export default function PwaDownloadFrame() {
  const [offlineState, setOfflineState] = useState({ status: 'idle', progress: initialProgress, error: '' });
  const [openSourceState, setOpenSourceState] = useState({ status: 'idle', progress: initialProgress, error: '' });
  const [refreshState, setRefreshState] = useState({ status: 'idle', error: '' });

  const inTelegram = useMemo(() => isTelegramEnvironment(), []);
  const progress = offlineState.progress.total
    ? Math.round((offlineState.progress.completed / offlineState.progress.total) * 100)
    : 0;

  const handleOfflineDownload = async (channel) => {
    setOfflineState({ status: 'loading', progress: initialProgress, error: '' });
    try {
      await cacheOfflineAssets({
        baseUrl: '/',
        onUpdate: (nextProgress) => setOfflineState({ status: 'loading', progress: nextProgress, error: '' })
      });
      setOfflineState({ status: 'success', progress: initialProgress, error: '' });
      if (channel === 'telegram' && window.Telegram?.WebApp?.showPopup) {
        window.Telegram.WebApp.showPopup({
          title: 'Ready to play',
          message: 'TonPlaygram is saved for faster loading in Telegram.'
        });
      }
    } catch (err) {
      setOfflineState({
        status: 'error',
        progress: initialProgress,
        error: err?.message || 'Download failed. Please try again.'
      });
    }
  };

  const handleOpenSourceDownload = async () => {
    setOpenSourceState({ status: 'loading', progress: initialProgress, error: '' });
    try {
      await cacheOpenSourceAssets({
        onUpdate: (nextProgress) => setOpenSourceState({ status: 'loading', progress: nextProgress, error: '' })
      });
      setOpenSourceState({ status: 'success', progress: initialProgress, error: '' });
    } catch (err) {
      setOpenSourceState({
        status: 'error',
        progress: initialProgress,
        error: err?.message || 'Unable to save the open-source files.'
      });
    }
  };

  const handleRefreshToLatest = async () => {
    setRefreshState({ status: 'loading', error: '' });
    try {
      if (!('serviceWorker' in navigator)) throw new Error('Updates are not supported in this browser.');

      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      const waitForInstall = registration.installing
        ? new Promise(resolve => {
            const worker = registration.installing;
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'installed' || worker.state === 'activated') resolve();
            });
          })
        : null;

      const targetWorker = registration.waiting || registration.installing;
      targetWorker?.postMessage({ type: 'SKIP_WAITING' });
      if (waitForInstall) {
        await Promise.race([waitForInstall, new Promise(resolve => setTimeout(resolve, 1500))]);
      }
      const activeWorker = navigator.serviceWorker.controller || registration.active || registration.waiting;
      activeWorker?.postMessage({ type: 'CHECK_FOR_UPDATE' });
      setRefreshState({ status: 'success', error: '' });
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      setRefreshState({ status: 'error', error: err?.message || 'Unable to update right now.' });
    }
  };

  const downloadLabel = offlineState.status === 'loading'
    ? `Saving ${progress}%`
    : offlineState.status === 'success'
      ? 'Ready to play'
      : 'Choose where you play';

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#151a2b] via-[#101522] to-[#0b0f19] shadow-2xl shadow-black/30">
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative p-4 sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30">
              <CloudDownload size={25} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="mb-0.5 flex items-center gap-2">
                <h3 className="truncate text-lg font-bold text-white">Save TonPlaygram</h3>
                <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">PWA</span>
              </div>
              <p className="text-sm text-slate-400">Faster launch. Play anywhere.</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-slate-400">
            v{APP_BUILD || 'dev'}
          </span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            className={`group relative min-h-[112px] rounded-2xl border p-3 text-left transition active:scale-[0.98] disabled:opacity-60 ${!inTelegram ? 'border-primary/60 bg-primary/10' : 'border-white/10 bg-white/[0.04] hover:border-primary/40'}`}
            onClick={() => handleOfflineDownload('chrome')}
            disabled={offlineState.status === 'loading'}
          >
            {!inTelegram && <span className="absolute right-2 top-2 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Best</span>}
            <Chrome className="mb-3 text-sky-300" size={24} />
            <p className="font-semibold text-white">Browser</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Chrome &amp; mobile</p>
          </button>
          <button
            type="button"
            className={`group relative min-h-[112px] rounded-2xl border p-3 text-left transition active:scale-[0.98] disabled:opacity-60 ${inTelegram ? 'border-primary/60 bg-primary/10' : 'border-white/10 bg-white/[0.04] hover:border-primary/40'}`}
            onClick={() => handleOfflineDownload('telegram')}
            disabled={offlineState.status === 'loading'}
          >
            {inTelegram && <span className="absolute right-2 top-2 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Best</span>}
            <Smartphone className="mb-3 text-violet-300" size={24} />
            <p className="font-semibold text-white">Telegram</p>
            <p className="mt-0.5 text-[11px] text-slate-400">In-app access</p>
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              {offlineState.status === 'success' ? <Check size={15} className="text-emerald-400" /> : <ShieldCheck size={15} className="text-emerald-400" />}
              {downloadLabel}
            </div>
            <button
              type="button"
              onClick={handleRefreshToLatest}
              disabled={refreshState.status === 'loading'}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-60"
            >
              <RefreshCw size={13} className={refreshState.status === 'loading' ? 'animate-spin' : ''} />
              {refreshState.status === 'success' ? 'Updated' : 'Update'}
            </button>
          </div>
          {offlineState.status === 'loading' && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-300 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          {(offlineState.error || refreshState.error) && (
            <p className="mt-2 text-xs text-red-400">{offlineState.error || refreshState.error}</p>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
          <PackageOpen size={17} className="shrink-0 text-slate-400" />
          <button
            type="button"
            onClick={handleOpenSourceDownload}
            disabled={openSourceState.status === 'loading'}
            className="flex min-w-0 flex-1 items-center justify-between text-left text-xs font-medium text-slate-400 transition hover:text-white disabled:opacity-60"
          >
            <span>{openSourceState.status === 'loading' ? 'Saving source files…' : openSourceState.status === 'success' ? 'Source files saved' : 'Save open-source files'}</span>
            <ChevronRight size={16} />
          </button>
        </div>
        {openSourceState.error && <p className="mt-2 text-xs text-red-400">{openSourceState.error}</p>}
      </div>
    </section>
  );
}
