import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { isTelegramEnvironment, readStorage, writeStorage } from '../pwa/installSupport.js';

const STORAGE_KEY = 'tonplaygram-pwa-dismissed';
const subscribers = new Set();
const serverState = { promptEvent: null, installed: false, dismissed: false, native: false, inTelegram: false, platform: 'other', installing: false, error: '' };
let state = serverState;
let initialized = false;
const emit = patch => {
  state = { ...state, ...patch };
  subscribers.forEach(listener => listener());
};
const getSnapshot = () => state;
const getServerSnapshot = () => serverState;
const subscribe = listener => { subscribers.add(listener); return () => subscribers.delete(listener); };

function initialize() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  const native = Capacitor.isNativePlatform();
  const media = window.matchMedia?.('(display-mode: standalone)');
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  emit({
    native, installed: native || Boolean(media?.matches || navigator.standalone),
    dismissed: readStorage(STORAGE_KEY) === '1',
    inTelegram: isTelegramEnvironment(), platform: ios ? 'ios' : /Android/i.test(ua) ? 'android' : 'other'
  });
  // One shared event: the layout banner and home card cannot consume it twice.
  window.addEventListener('beforeinstallprompt', event => {
    if (native) return;
    event.preventDefault();
    emit({ promptEvent: event, error: '' });
  });
  window.addEventListener('appinstalled', () => emit({ installed: true, promptEvent: null, installing: false }));
  const onDisplayMode = () => emit({ installed: native || Boolean(media?.matches || navigator.standalone) });
  if (media?.addEventListener) media.addEventListener('change', onDisplayMode);
  else media?.addListener?.(onDisplayMode);
}
initialize();

function dismiss() {
  writeStorage(STORAGE_KEY, '1');
  emit({ dismissed: true });
}

async function promptToInstall() {
  const event = state.promptEvent;
  if (!event || state.native || state.installed || state.installing) return false;
  emit({ promptEvent: null, installing: true, error: '' });
  try {
    // Keep this in the user's click call stack; no network request before prompt().
    const result = await event.prompt();
    const choice = result?.outcome ? result : await event.userChoice;
    if (choice?.outcome === 'accepted') return true;
    dismiss();
    return false;
  } catch {
    emit({ error: 'The install prompt could not open. Use your browser menu to install.' });
    return false;
  } finally {
    // Acceptance is not proof of installation; appinstalled/display-mode confirms it.
    emit({ installing: false });
  }
}

function openExternalInstall() {
  // Do not forward Telegram initData, account IDs or auth fragments into another browser.
  const url = new URL(import.meta.env?.BASE_URL || '/', window.location.origin).href;
  try {
    if (isTelegramEnvironment() && window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url, { try_instant_view: false });
      return;
    }
  } catch { /* Fall back to an ordinary external browser window. */ }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function usePwaInstallPrompt() {
  initialize();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const canInstall = !snapshot.native && !snapshot.installed && !snapshot.installing && Boolean(snapshot.promptEvent);
  const canShowTelegramInstall = !snapshot.native && !snapshot.installed && !snapshot.dismissed && snapshot.inTelegram && !snapshot.promptEvent;
  return {
    ...snapshot, canInstall, canShowTelegramInstall,
    mode: canInstall && !snapshot.dismissed ? 'prompt' : canShowTelegramInstall ? 'telegram' : 'none',
    promptToInstall, openExternalInstall, dismiss
  };
}
