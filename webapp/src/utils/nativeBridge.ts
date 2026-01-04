import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { authenticateDevice, checkBiometricAvailability } from './deviceBiometric.ts';

type InitUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};

type ShimConfig = {
  user?: InitUser | null;
  startParam?: string | null;
};

const PREF_KEYS = {
  id: 'telegramId',
  username: 'telegramUsername',
  first: 'telegramFirstName',
  last: 'telegramLastName',
  userData: 'telegramUserData',
  start: 'telegramStartParam'
};

const events = new Map<string, Set<(...args: unknown[]) => void>>();

function isNativeWebView() {
  return Boolean(Capacitor?.isNativePlatform?.() && !window.Telegram?.WebApp?.initDataUnsafe?.user);
}

async function loadPref(key: string) {
  try {
    const res = await Preferences.get({ key });
    return res.value ?? null;
  } catch {
    return null;
  }
}

async function savePref(key: string, value: string) {
  try {
    await Preferences.set({ key, value });
  } catch {
    // ignore
  }
}

function parseUserFromUrl(url?: string | null): Partial<ShimConfig> {
  if (!url) return {};
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    const rawId = params.get('user_id') || params.get('telegramId') || params.get('tg');
    const username = params.get('username') || params.get('user');
    const first_name = params.get('first') || params.get('first_name') || undefined;
    const last_name = params.get('last') || params.get('last_name') || undefined;
    const startParam =
      params.get('ref') || params.get('startapp') || params.get('start') || params.get('start_param');
    const id = rawId ? Number(rawId) : null;
    const user: InitUser | null = id ? { id, username: username || undefined, first_name, last_name } : null;
    return { user, startParam: startParam || null };
  } catch {
    return {};
  }
}

function mergeUser(primary?: InitUser | null, fallback?: InitUser | null): InitUser | null {
  if (primary?.id) return primary;
  if (fallback?.id) return fallback;
  return null;
}

function toInitData(user?: InitUser | null, startParam?: string | null) {
  const params = new URLSearchParams();
  if (user?.id) params.set('user_id', String(user.id));
  if (user?.username) params.set('username', user.username);
  if (startParam) params.set('start_param', startParam);
  return params.toString();
}

function emit(event: string, ...args: unknown[]) {
  const set = events.get(event);
  if (!set) return;
  set.forEach((cb) => {
    try {
      cb(...args);
    } catch {
      // ignore individual listener errors
    }
  });
}

function ensureBackButtonShim(webApp: any) {
  if (webApp.BackButton) return;
  let visible = false;
  webApp.BackButton = {
    isVisible: () => visible,
    show: () => {
      visible = true;
    },
    hide: () => {
      visible = false;
    },
    onClick: (cb: () => void) => {
      webApp.onEvent('backButtonClicked', cb);
    }
  };
}

function ensureEventBus(webApp: any) {
  if (webApp.onEvent && webApp.offEvent) return;
  webApp.onEvent = (event: string, cb: (...args: unknown[]) => void) => {
    if (!events.has(event)) events.set(event, new Set());
    events.get(event)!.add(cb);
  };
  webApp.offEvent = (event: string, cb: (...args: unknown[]) => void) => {
    const set = events.get(event);
    if (!set) return;
    set.delete(cb);
  };
}

function ensureBiometricShim(webApp: any) {
  if (webApp.BiometricManager) return;
  webApp.BiometricManager = {
    isBiometricAvailable: async () => {
      const result = await checkBiometricAvailability();
      if (!result.available && result.reason === 'not_enrolled') {
        return { available: false, code: 'biometryNotEnrolled' };
      }
      return { available: result.available, biometryType: result.type };
    },
    authenticate: async (options?: { reason?: string }) => {
      const result = await authenticateDevice(options?.reason);
      return {
        ok: result.ok,
        success: result.ok,
        authenticated: result.ok,
        error: result.error
      };
    }
  };
}

function applyShim({ user, startParam }: ShimConfig) {
  if (!window.Telegram) window.Telegram = {} as any;
  const telegram = window.Telegram as any;
  if (!telegram.WebApp) telegram.WebApp = {};
  const webApp = telegram.WebApp;

  ensureEventBus(webApp);
  ensureBackButtonShim(webApp);
  ensureBiometricShim(webApp);

  webApp.isExpanded = true;
  webApp.initDataUnsafe = webApp.initDataUnsafe || {};
  if (user?.id) {
    webApp.initDataUnsafe.user = user;
  }
  if (startParam) {
    webApp.initDataUnsafe.start_param = startParam;
  }
  webApp.initData = webApp.initData || toInitData(user, startParam);
  if (!webApp.ready) webApp.ready = () => {};
  if (!webApp.disableVerticalSwipes) webApp.disableVerticalSwipes = () => {};
}

async function loadStoredUser(): Promise<ShimConfig> {
  const [idRaw, username, first, last, userData, startParam] = await Promise.all([
    loadPref(PREF_KEYS.id),
    loadPref(PREF_KEYS.username),
    loadPref(PREF_KEYS.first),
    loadPref(PREF_KEYS.last),
    loadPref(PREF_KEYS.userData),
    loadPref(PREF_KEYS.start)
  ]);

  if (userData) {
    try {
      const parsed = JSON.parse(userData);
      return { user: parsed, startParam };
    } catch {
      // ignore and fallback
    }
  }

  const id = idRaw ? Number(idRaw) : null;
  const user = id
    ? {
        id,
        username: username || undefined,
        first_name: first || undefined,
        last_name: last || undefined
      }
    : null;
  return { user, startParam };
}

async function persistShimData(config: ShimConfig) {
  const { user, startParam } = config;
  if (user?.id) {
    await Promise.all([
      savePref(PREF_KEYS.id, String(user.id)),
      user.username ? savePref(PREF_KEYS.username, user.username) : Promise.resolve(),
      user.first_name ? savePref(PREF_KEYS.first, user.first_name) : Promise.resolve(),
      user.last_name ? savePref(PREF_KEYS.last, user.last_name) : Promise.resolve(),
      savePref(PREF_KEYS.userData, JSON.stringify(user))
    ]);
  }
  if (startParam) {
    await savePref(PREF_KEYS.start, startParam);
  }
}

function refreshInitData(config: ShimConfig) {
  applyShim(config);
  emit('telegramInitDataUpdated', config);
}

export async function initNativeBridge() {
  if (!isNativeWebView()) return;

  const stored = await loadStoredUser();

  const launchUrl = await CapacitorApp.getLaunchUrl?.();
  const deepLinkConfig = parseUserFromUrl(launchUrl?.url);
  const mergedUser = mergeUser(deepLinkConfig.user || null, stored.user || null);
  const startParam = deepLinkConfig.startParam || stored.startParam || null;
  const config: ShimConfig = { user: mergedUser, startParam };

  refreshInitData(config);
  await persistShimData(config);

  window.addEventListener('backButtonClicked', () => emit('backButtonClicked'));

  CapacitorApp.addListener('backButton', () => {
    emit('backButtonClicked');
  });

  CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    const parsed = parseUserFromUrl(url);
    const nextConfig: ShimConfig = {
      user: mergeUser(parsed.user || null, config.user || null),
      startParam: parsed.startParam || config.startParam || null
    };
    refreshInitData(nextConfig);
    void persistShimData(nextConfig);
  });
}

export function isNativeBridgeActive() {
  return Boolean(window.Telegram?.WebApp && events.size > 0);
}

export function emitBackButton() {
  emit('backButtonClicked');
}

export { isNativeWebView };
