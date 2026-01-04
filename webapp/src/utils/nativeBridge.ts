import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

type TelegramWebAppShim = {
  initData?: string;
  initDataUnsafe?: Record<string, unknown>;
  isExpanded?: boolean;
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: BackButtonListener) => void;
    offClick: (cb: BackButtonListener) => void;
    __nativeTrigger: () => void;
  };
  ready: () => void;
  expand: () => void;
  disableVerticalSwipes: () => void;
  onEvent: (name: string, cb: BackButtonListener) => void;
  offEvent: (name: string, cb: BackButtonListener) => void;
};

type TelegramShim = {
  WebApp: TelegramWebAppShim;
};

declare global {
  interface Window {
    Telegram?: TelegramShim;
    __TONPLAYGRAM_BRIDGE__?: unknown;
  }
}

export type BridgeUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};

type BridgeState = {
  user?: BridgeUser;
  startParam?: string;
  initData?: string;
  source?: 'storage' | 'deeplink' | 'unknown';
};

type BackButtonListener = () => void;

const STORAGE_KEYS = {
  user: 'telegramUserData',
  id: 'telegramId',
  username: 'telegramUsername',
  first: 'telegramFirstName',
  last: 'telegramLastName',
  start: 'telegramStartParam'
};

const backButtonListeners = new Set<BackButtonListener>();
let backButtonVisible = false;
const bridgeState: BridgeState = {};

function parseUserFromUrl(url?: string): BridgeUser | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const idParam =
      parsed.searchParams.get('user_id') ||
      parsed.searchParams.get('tgId') ||
      parsed.searchParams.get('telegramId');
    const username = parsed.searchParams.get('username') || parsed.searchParams.get('tgUsername');
    const firstName = parsed.searchParams.get('first_name') || parsed.searchParams.get('firstName');
    const lastName = parsed.searchParams.get('last_name') || parsed.searchParams.get('lastName');
    const id = idParam ? Number(idParam) : undefined;
    if (!id && !username && !firstName && !lastName) return undefined;
    return {
      id: Number.isFinite(id) ? id : undefined,
      username: username || undefined,
      first_name: firstName || undefined,
      last_name: lastName || undefined
    };
  } catch (err) {
    console.warn('Failed to parse bridge user from URL', err);
    return undefined;
  }
}

function parseStartParam(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const param =
      parsed.searchParams.get('start_param') ||
      parsed.searchParams.get('ref') ||
      parsed.searchParams.get('tgWebAppStartParam');
    if (param) return param;
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    return pathParts[0];
  } catch (err) {
    console.warn('Failed to parse start_param from URL', err);
    return undefined;
  }
}

async function loadStoredUser(): Promise<BridgeUser | undefined> {
  if (!Capacitor.isNativePlatform()) return undefined;
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEYS.user });
    if (value) return JSON.parse(value) as BridgeUser;
    const [{ value: id }, { value: username }, { value: first }, { value: last }] = await Promise.all([
      Preferences.get({ key: STORAGE_KEYS.id }),
      Preferences.get({ key: STORAGE_KEYS.username }),
      Preferences.get({ key: STORAGE_KEYS.first }),
      Preferences.get({ key: STORAGE_KEYS.last })
    ]);
    if (!id && !username && !first && !last) return undefined;
    const parsedId = id ? Number(id) : undefined;
    return {
      id: Number.isFinite(parsedId) ? parsedId : undefined,
      username: username || undefined,
      first_name: first || undefined,
      last_name: last || undefined
    };
  } catch (err) {
    console.warn('Failed to load bridge user', err);
    return undefined;
  }
}

async function loadStoredStartParam(): Promise<string | undefined> {
  if (!Capacitor.isNativePlatform()) return undefined;
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEYS.start });
    return value || undefined;
  } catch (err) {
    console.warn('Failed to load stored start param', err);
    return undefined;
  }
}

async function persistBridgeUser(user?: BridgeUser, startParam?: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (user) {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (user.id != null) window.localStorage.setItem(STORAGE_KEYS.id, String(user.id));
        if (user.username) window.localStorage.setItem(STORAGE_KEYS.username, user.username);
        if (user.first_name) window.localStorage.setItem(STORAGE_KEYS.first, user.first_name);
        if (user.last_name) window.localStorage.setItem(STORAGE_KEYS.last, user.last_name);
        window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
      }
      await Preferences.set({ key: STORAGE_KEYS.user, value: JSON.stringify(user) });
      if (user.id != null) await Preferences.set({ key: STORAGE_KEYS.id, value: String(user.id) });
      if (user.username) await Preferences.set({ key: STORAGE_KEYS.username, value: user.username });
      if (user.first_name) await Preferences.set({ key: STORAGE_KEYS.first, value: user.first_name });
      if (user.last_name) await Preferences.set({ key: STORAGE_KEYS.last, value: user.last_name });
    }
    if (startParam) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEYS.start, startParam);
      }
      await Preferences.set({ key: STORAGE_KEYS.start, value: startParam });
    }
  } catch (err) {
    console.warn('Failed to persist bridge user', err);
  }
}

function buildInitDataString(user?: BridgeUser, startParam?: string): string {
  const params = new URLSearchParams();
  if (user?.id != null) params.set('user_id', String(user.id));
  if (user?.username) params.set('username', user.username);
  if (startParam) params.set('start_param', startParam);
  params.set('platform', 'native');
  return params.toString();
}

function emitBackButtonClick() {
  if (!backButtonVisible && !backButtonListeners.size) return;
  backButtonListeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.warn('BackButton listener failed', err);
    }
  });
  if (!backButtonListeners.size) {
    try {
      window.history.back();
    } catch {
      // ignore
    }
  }
}

function installBackButtonHandler() {
  if (!Capacitor.isNativePlatform()) return;
  void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (backButtonVisible || canGoBack) {
      emitBackButtonClick();
    } else if (CapacitorApp.exitApp) {
      CapacitorApp.exitApp();
    }
  });
}

function createTelegramShim(user?: BridgeUser, startParam?: string) {
  if (window.Telegram?.WebApp?.initDataUnsafe) return; // Do not override real Telegram

  const initData = buildInitDataString(user, startParam);
  const initDataUnsafe: Record<string, unknown> = {
    user,
    start_param: startParam
  };

  const BackButton = {
    isVisible: false,
    show() {
      this.isVisible = true;
      backButtonVisible = true;
    },
    hide() {
      this.isVisible = false;
      backButtonVisible = false;
    },
    onClick(callback: BackButtonListener) {
      backButtonListeners.add(callback);
    },
    offClick(callback: BackButtonListener) {
      backButtonListeners.delete(callback);
    },
    __nativeTrigger() {
      emitBackButtonClick();
    }
  };

  const webApp = {
    initData,
    initDataUnsafe,
    isExpanded: true,
    expand() {
      this.isExpanded = true;
    },
    ready() {
      // no-op, provided for API parity
    },
    onEvent(name: string, callback: BackButtonListener) {
      if (name === 'backButtonClicked') backButtonListeners.add(callback);
    },
    offEvent(name: string, callback: BackButtonListener) {
      if (name === 'backButtonClicked') backButtonListeners.delete(callback);
    },
    BackButton,
    disableVerticalSwipes() {
      /* no-op for native shim */
    }
  } as TelegramWebAppShim;

  window.Telegram = { WebApp: webApp };

  bridgeState.user = user;
  bridgeState.startParam = startParam;
  bridgeState.initData = initData;
  bridgeState.source = 'unknown';

  (window as any).__TONPLAYGRAM_BRIDGE__ = {
    ...bridgeState,
    emitBackButtonClick
  };
}

async function applyInitialUrl(url?: string) {
  const parsedUser = parseUserFromUrl(url);
  const parsedStart = parseStartParam(url);
  if (parsedUser || parsedStart) {
    createTelegramShim(parsedUser, parsedStart);
    await persistBridgeUser(parsedUser, parsedStart);
    bridgeState.source = 'deeplink';
  }
}

export async function initNativeBridge() {
  if (!Capacitor.isNativePlatform()) return;
  if (window.Telegram?.WebApp?.initDataUnsafe) return;

  const [storedUser, storedStart] = await Promise.all([loadStoredUser(), loadStoredStartParam()]);
  createTelegramShim(storedUser, storedStart);
  if (storedUser || storedStart) bridgeState.source = 'storage';

  installBackButtonHandler();

  try {
    const launchUrl = (CapacitorApp as any)?.getLaunchUrl ? await (CapacitorApp as any).getLaunchUrl() : undefined;
    if (launchUrl?.url) {
      await applyInitialUrl(launchUrl.url as string);
    } else {
      await applyInitialUrl(window?.location?.href);
    }
  } catch {
    await applyInitialUrl(window?.location?.href);
  }

  void CapacitorApp.addListener('appUrlOpen', async (event) => {
    await applyInitialUrl(event.url);
  });
}

export function getNativeBridgeHeaders() {
  if (window?.Telegram?.WebApp?.initData) return {};
  const headers: Record<string, string> = {};
  if (bridgeState.initData) headers['X-Telegram-Init-Data'] = bridgeState.initData;
  if (bridgeState.user?.id != null) headers['X-Telegram-User-Id'] = String(bridgeState.user.id);
  if (bridgeState.user?.username) headers['X-Telegram-Username'] = bridgeState.user.username;
  if (bridgeState.startParam) headers['X-Telegram-Start-Param'] = bridgeState.startParam;
  headers['X-TPC-Client'] = 'native';
  return headers;
}

export function getBridgeState(): BridgeState {
  return { ...bridgeState };
}

export function ensureBackButtonTriggered() {
  emitBackButtonClick();
}
