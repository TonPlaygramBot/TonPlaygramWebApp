const STORAGE_KEY = 'tonplaygram-pwa-dismissed';
const HOME_SCREEN_STATUSES = new Set(['unsupported', 'unknown', 'added', 'missed']);
const listeners = new Set();
let initialized = false;
let telegramApp = null;
let telegramSupported = false;
let browserInstalled = false;
let homeScreenAdded = false;

let snapshot = {
  promptEvent: null,
  installed: false,
  dismissed: false,
  installPending: false,
  telegramDetected: false,
  telegramCanAddHomeScreen: false,
  telegramHomeScreenStatus: 'unsupported',
  installationGuidance: 'Open your browser menu and choose Install app or Add to Home Screen.',
  error: ''
};

function update(changes) {
  if (!Object.keys(changes).some(key => snapshot[key] !== changes[key])) return;
  snapshot = { ...snapshot, ...changes };
  for (const listener of listeners) listener();
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator?.standalone === true ||
    window.Capacitor?.isNativePlatform?.()
  );
}

function isTelegram(app) {
  // telegram-web-app.js creates a WebApp stub in ordinary browsers as well.
  const platform = String(app?.platform || '').toLowerCase();
  return Boolean(app && (
    (typeof app.initData === 'string' && app.initData.trim()) ||
    (platform && platform !== 'unknown' && platform !== 'browser')
  ));
}

function supportsHomeScreen(app) {
  if (!isTelegram(app) || typeof app.addToHomeScreen !== 'function') return false;
  try {
    if (typeof app.isVersionAtLeast === 'function') return app.isVersionAtLeast('8.0');
    return Number.parseFloat(app.version) >= 8;
  } catch {
    return false;
  }
}

function guidance() {
  if (snapshot.telegramDetected) {
    return snapshot.telegramCanAddHomeScreen
      ? 'Tap Add to Home Screen and confirm in Telegram. Your phone may not report when the icon has been added.'
      : 'Open this page in Safari or Chrome, then use Share or the browser menu to add TonPlayGram to your Home Screen. Downloads may need to be saved again in that browser.';
  }
  const navigator = typeof window !== 'undefined' ? window.navigator : null;
  const ios = /iPad|iPhone|iPod/.test(navigator?.userAgent || '') ||
    (navigator?.platform === 'MacIntel' && navigator?.maxTouchPoints > 1);
  return ios
    ? 'In Safari, tap Share, then Add to Home Screen, then Add. Open TonPlayGram from its new icon to check your downloads.'
    : 'Open your browser menu and choose Install app or Add to Home Screen, then confirm.';
}

function updateHomeScreenStatus(status) {
  if (!HOME_SCREEN_STATUSES.has(status)) return;
  if (status === 'added') homeScreenAdded = true;
  if (status === 'missed') homeScreenAdded = false;
  update({
    telegramHomeScreenStatus: status,
    telegramCanAddHomeScreen: supportsHomeScreen(telegramApp) && status !== 'unsupported',
    installed: browserInstalled || isStandalone() || homeScreenAdded
  });
  update({ installationGuidance: guidance() });
}

function onHomeScreenAdded() {
  updateHomeScreenStatus('added');
  update({ installPending: false });
}

function onHomeScreenChecked(event) {
  updateHomeScreenStatus(typeof event === 'string' ? event : event?.status);
}

function refreshEnvironment() {
  const app = window.Telegram?.WebApp;
  const detected = isTelegram(app);
  const supported = supportsHomeScreen(app);
  if (app !== telegramApp || supported !== telegramSupported || detected !== snapshot.telegramDetected) {
    try {
      telegramApp?.offEvent?.('homeScreenAdded', onHomeScreenAdded);
      telegramApp?.offEvent?.('homeScreenChecked', onHomeScreenChecked);
    } catch { /* A replaced SDK may no longer accept event subscriptions. */ }
    telegramApp = app;
    telegramSupported = supported;
    homeScreenAdded = false;
    update({ telegramHomeScreenStatus: supported ? 'unknown' : 'unsupported' });
    try {
      if (supported && typeof app.onEvent === 'function') {
        app.onEvent('homeScreenAdded', onHomeScreenAdded);
        app.onEvent('homeScreenChecked', onHomeScreenChecked);
      }
    } catch { /* Status callbacks can still report successful installation. */ }
  }
  update({
    telegramDetected: detected,
    telegramCanAddHomeScreen: supportsHomeScreen(app) && snapshot.telegramHomeScreenStatus !== 'unsupported',
    installed: browserInstalled || isStandalone() || homeScreenAdded
  });
  update({ installationGuidance: guidance() });
  if (supportsHomeScreen(app) && typeof app.checkHomeScreenStatus === 'function') {
    try {
      app.checkHomeScreenStatus(status => {
        if (app === telegramApp) updateHomeScreenStatus(status);
      });
    } catch {
      // SDK stubs and older clients may expose methods they cannot execute.
      updateHomeScreenStatus('unsupported');
    }
  }
}

/** Initialize before bootstrap awaits; every hook shares the retained event. */
export function initializeInstallPrompt() {
  if (typeof window === 'undefined') return;
  if (!initialized) {
    initialized = true;
    try {
      update({ dismissed: window.localStorage.getItem(STORAGE_KEY) === '1' });
    } catch { /* Storage restrictions must not prevent installation. */ }
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      update({ promptEvent: event, error: '' });
    });
    window.addEventListener('appinstalled', () => {
      browserInstalled = true;
      update({ installed: true, promptEvent: null, installPending: false, error: '' });
    });
    window.addEventListener('pageshow', refreshEnvironment);
    window.addEventListener('focus', refreshEnvironment);
    window.document?.addEventListener('DOMContentLoaded', refreshEnvironment);
    window.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change', refreshEnvironment);
  }
  refreshEnvironment();
}

export const getInstallPromptSnapshot = () => snapshot;

export function subscribeInstallPrompt(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dismissInstallBanner() {
  update({ dismissed: true });
  try { window.localStorage.setItem(STORAGE_KEY, '1'); } catch { /* Optional preference. */ }
}

/** Call directly from a user click, before awaiting downloads or other work. */
export async function requestInstall() {
  initializeInstallPrompt();
  if (snapshot.installed) return { outcome: 'installed' };
  if (snapshot.installPending) return { outcome: 'requested' };
  const event = snapshot.promptEvent;
  if (event) {
    // Each browser event is single-use, even after dismissal or failure.
    update({ promptEvent: null, installPending: true, error: '' });
    try {
      const promptResult = event.prompt();
      // Observe both promises immediately, including a rejected prompt().
      const [promptChoice, userChoice] = await Promise.all([promptResult, event.userChoice]);
      const result = userChoice || promptChoice;
      const outcome = result?.outcome === 'accepted' ? 'accepted' : 'dismissed';
      // appinstalled (or a standalone launch) confirms actual installation.
      return { outcome };
    } catch (error) {
      update({ error: error?.message || 'The install prompt could not be opened.' });
      return { outcome: 'error', instructions: guidance() };
    } finally {
      update({ installPending: false });
    }
  }
  if (snapshot.telegramCanAddHomeScreen) {
    try {
      telegramApp.addToHomeScreen();
      return { outcome: 'requested' };
    } catch (error) {
      updateHomeScreenStatus('unsupported');
      update({ error: error?.message || 'Open TonPlayGram in your browser to install it.' });
      return { outcome: 'error', instructions: guidance() };
    }
  }
  return { outcome: 'instructions', instructions: guidance() };
}

export function openExternalInstall() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  // Do not carry Telegram launch credentials into an external installation.
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('tgWebApp')) url.searchParams.delete(key);
  }
  if (url.hash.includes('tgWebApp')) url.hash = '';
  try {
    if (isTelegram(window.Telegram?.WebApp) && window.Telegram.WebApp.openLink) {
      window.Telegram.WebApp.openLink(url.href, { try_instant_view: false });
      return;
    }
  } catch { /* Older embedded clients may require the browser fallback. */ }
  window.open(url.href, '_blank', 'noopener,noreferrer');
}
