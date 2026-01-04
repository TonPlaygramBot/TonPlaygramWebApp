import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences';

type TelegramUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};

type BridgeState = {
  user?: TelegramUser | null;
  startParam?: string;
  initData?: string;
};

const STORAGE_KEYS = {
  id: 'telegramId',
  username: 'telegramUsername',
  firstName: 'telegramFirstName',
  lastName: 'telegramLastName',
  initData: 'telegramInitData',
  startParam: 'telegramStartParam'
};

const BACK_EVENT = 'backButtonClicked';

const listeners: Record<string, Set<(...args: unknown[]) => void>> = {
  [BACK_EVENT]: new Set()
};

let backVisible = false;

function emit(event: string) {
  const subs = listeners[event];
  if (!subs?.size) return;
  subs.forEach((cb) => {
    try {
      cb();
    } catch (err) {
      console.warn(`bridge handler for ${event} failed`, err);
    }
  });
}

function toNumber(value?: string | number | null) {
  if (value == null) return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
}

async function persistToPreferences(payload: BridgeState) {
  try {
    if (payload.user?.id != null) {
      await Preferences.set({ key: STORAGE_KEYS.id, value: String(payload.user.id) });
    }
    if (payload.user?.username) {
      await Preferences.set({ key: STORAGE_KEYS.username, value: payload.user.username });
    }
    if (payload.user?.first_name) {
      await Preferences.set({ key: STORAGE_KEYS.firstName, value: payload.user.first_name });
    }
    if (payload.user?.last_name) {
      await Preferences.set({ key: STORAGE_KEYS.lastName, value: payload.user.last_name });
    }
    if (payload.initData) {
      await Preferences.set({ key: STORAGE_KEYS.initData, value: payload.initData });
    }
    if (payload.startParam) {
      await Preferences.set({ key: STORAGE_KEYS.startParam, value: payload.startParam });
    }
  } catch (err) {
    console.warn('Failed to persist native bridge data', err);
  }
}

async function loadStoredUser(): Promise<BridgeState> {
  try {
    const [{ value: id }, { value: username }, { value: firstName }, { value: lastName }, { value: initData }, { value: startParam }] =
      await Promise.all([
        Preferences.get({ key: STORAGE_KEYS.id }),
        Preferences.get({ key: STORAGE_KEYS.username }),
        Preferences.get({ key: STORAGE_KEYS.firstName }),
        Preferences.get({ key: STORAGE_KEYS.lastName }),
        Preferences.get({ key: STORAGE_KEYS.initData }),
        Preferences.get({ key: STORAGE_KEYS.startParam })
      ]);
    const user: TelegramUser | undefined =
      id || username || firstName || lastName
        ? {
            id: toNumber(id),
            username: username || undefined,
            first_name: firstName || undefined,
            last_name: lastName || undefined
          }
        : undefined;
    return { user, initData: initData || undefined, startParam: startParam || undefined };
  } catch {
    return {};
  }
}

function parseDeepLink(url?: string | null): BridgeState {
  if (!url) return {};
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    const hostParam = parsed.host && parsed.host !== 'localhost' ? parsed.host : '';
    const id = params.get('tg') || params.get('telegramId') || params.get('user') || params.get('user_id');
    const username = params.get('username') || params.get('user_name');
    const first = params.get('first_name') || params.get('firstName');
    const last = params.get('last_name') || params.get('lastName');
    const pathParam = parsed.pathname?.replace(/^\//, '') || '';
    const startParam =
      params.get('startapp') ||
      params.get('ref') ||
      params.get('referral') ||
      params.get('start_param') ||
      hostParam ||
      (pathParam && pathParam !== parsed.host ? pathParam : '');
    const user: TelegramUser | undefined =
      id || username || first || last
        ? {
            id: toNumber(id),
            username: username || undefined,
            first_name: first || undefined,
            last_name: last || undefined
          }
        : undefined;
    return { user, startParam: startParam || undefined };
  } catch {
    return {};
  }
}

function buildInitData(user?: TelegramUser | null, startParam?: string, source = 'capacitor'): string | undefined {
  if (!user && !startParam) return undefined;
  const params = new URLSearchParams();
  if (user) params.set('user', JSON.stringify(user));
  params.set('source', source);
  if (startParam) params.set('start_param', startParam);
  return params.toString();
}

function ensureTelegramWebApp(state: BridgeState, platform?: string) {
  if (typeof window === 'undefined') return;
  const current = window.Telegram || {};
  const initData = state.initData || buildInitData(state.user, state.startParam);
  const initDataUnsafe = {
    user: state.user || undefined,
    start_param: state.startParam || undefined
  };

  if (!current.WebApp) current.WebApp = {};
  const webApp = current.WebApp;
  webApp.initData = initData;
  webApp.initDataUnsafe = initDataUnsafe;
  webApp.isExpanded = true;
  webApp.platform = platform || webApp.platform || 'unknown';
  webApp.expand = webApp.expand || (() => {});
  webApp.ready = webApp.ready || (() => {});
  webApp.BackButton = webApp.BackButton || {
    show: () => {
      backVisible = true;
    },
    hide: () => {
      backVisible = false;
    }
  };
  webApp.BackButton.show = () => {
    backVisible = true;
  };
  webApp.BackButton.hide = () => {
    backVisible = false;
  };
  webApp.onEvent = (event: string, handler: () => void) => {
    if (!listeners[event]) listeners[event] = new Set();
    listeners[event].add(handler);
  };
  webApp.offEvent = (event: string, handler: () => void) => {
    listeners[event]?.delete(handler);
  };
  webApp._fireEvent = (event: string) => emit(event);

  window.Telegram = current;
}

async function getLaunchUrl(): Promise<string | undefined> {
  try {
    const launch = await CapacitorApp.getLaunchUrl();
    if (launch?.url) return launch.url;
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') return window.location.href;
  return undefined;
}

async function syncFromUrl(url?: string | null, platform?: string) {
  const deeplink = parseDeepLink(url || undefined);
  if (!deeplink.user && !deeplink.startParam) return;
  const initData = buildInitData(deeplink.user, deeplink.startParam);
  const nextState: BridgeState = { ...deeplink, initData };
  ensureTelegramWebApp(nextState, platform);
  await persistToPreferences(nextState);
}

export async function initNativeBridge(): Promise<BridgeState | null> {
  if (!Capacitor.isNativePlatform()) return null;
  if (window?.Telegram?.WebApp?.initData) return { user: window.Telegram.WebApp.initDataUnsafe?.user };

  const [info, stored] = await Promise.all([Device.getInfo().catch(() => ({ platform: 'unknown' })), loadStoredUser()]);
  const launchUrl = await getLaunchUrl();
  const deeplink = parseDeepLink(launchUrl);
  const state: BridgeState = {
    user: deeplink.user || stored.user,
    startParam: deeplink.startParam || stored.startParam,
    initData: stored.initData || buildInitData(deeplink.user || stored.user, deeplink.startParam || stored.startParam)
  };

  ensureTelegramWebApp(state, info.platform);
  await persistToPreferences(state);
  if (launchUrl) await syncFromUrl(launchUrl, info.platform);

  CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    void syncFromUrl(url, info.platform);
  });

  // Android hardware back button
  CapacitorApp.addListener('backButton', () => {
    if (backVisible) {
      emit(BACK_EVENT);
      return;
    }
    emit(BACK_EVENT);
  });

  return state;
}
