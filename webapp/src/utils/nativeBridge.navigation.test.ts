import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }), exitApp: vi.fn(), get: vi.fn().mockResolvedValue({ value: null }) }));
vi.mock('@capacitor/app', () => ({ App: { addListener: mocks.addListener, exitApp: mocks.exitApp } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: mocks.get, set: vi.fn() } }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({ value: null });
  delete window.Telegram;
  delete window.__TONPLAYGRAM_BRIDGE__;
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('native Back installation', () => {
  it('installs once even when Telegram already exists, and forwards hardware Back to the app', async () => {
    (window as any).Telegram = { WebApp: { initDataUnsafe: {} } };
    const { registerAppBackHandler } = await import('./backNavigation.js');
    const { initNativeBridge } = await import('./nativeBridge');
    const back = vi.fn(() => true);
    const cleanup = registerAppBackHandler(back);
    await initNativeBridge();
    await initNativeBridge();
    const registrations = mocks.addListener.mock.calls.filter(([event]) => event === 'backButton');
    expect(registrations).toHaveLength(1);
    registrations[0][1]({ canGoBack: true });
    expect(back).toHaveBeenCalledTimes(1);
    expect(mocks.exitApp).not.toHaveBeenCalled();
    cleanup();
  });
});

describe('native authentication metadata', () => {
  it.each([false, true])('does not invent Telegram credentials with stored metadata=%s', async (hasStoredUser) => {
    const user = { id: 123, username: 'native-player' };
    if (hasStoredUser) {
      mocks.get.mockImplementation(async ({ key }) => ({ value:
        key === 'telegramUserData' ? JSON.stringify(user) :
        key === 'telegramStartParam' ? 'game-invite' : null
      }));
    }
    const { initNativeBridge, getNativeBridgeHeaders, getBridgeState } = await import('./nativeBridge');
    await initNativeBridge();

    expect(window.Telegram?.WebApp.initData).toBe('');
    expect(getNativeBridgeHeaders()).not.toHaveProperty('X-Telegram-Init-Data');
    expect(getNativeBridgeHeaders()['X-TPG-Client']).toBe('native');
    if (hasStoredUser) {
      expect(window.Telegram?.WebApp.initDataUnsafe?.user).toEqual(user);
      expect(getBridgeState()).toMatchObject({ user, startParam: 'game-invite' });
      expect(getNativeBridgeHeaders()).toMatchObject({
        'X-Telegram-User-Id': '123',
        'X-Telegram-Username': 'native-player',
        'X-Telegram-Start-Param': 'game-invite'
      });
    }
  });

  it('sends a Google credential through the real API client without unsigned Telegram data', async () => {
    const { initNativeBridge } = await import('./nativeBridge');
    await initNativeBridge();
    // A client-side freshness fixture; server signature validation is unchanged.
    const payload = btoa(JSON.stringify({ sub: 'google-player', exp: Math.floor(Date.now() / 1000) + 600 }));
    const credential = `header.${payload}.signature`;
    sessionStorage.setItem('socialGoogleCredential', credential);
    localStorage.setItem('googleId', 'google-player');
    const request = vi.fn().mockResolvedValue({ ok: true, text: async () => '{"ok":true}' });
    vi.stubGlobal('fetch', request);
    const { post } = await import('./api.js');

    expect(await post('/api/account/create', { googleId: 'google-player' })).toEqual({ ok: true });
    const headers = request.mock.calls[0][1].headers;
    expect(headers['X-Google-Id-Token']).toBe(credential);
    expect(headers).not.toHaveProperty('X-Telegram-Init-Data');
  });

  it('preserves existing Telegram Mini App credentials and forwards them unchanged', async () => {
    const initData = 'user=%7B%22id%22%3A123%7D&auth_date=1234567890&hash=telegram-signature';
    const telegram = { WebApp: { initData, initDataUnsafe: { user: { id: 123 } } } };
    window.Telegram = telegram as typeof window.Telegram;
    const { initNativeBridge, getNativeBridgeHeaders } = await import('./nativeBridge');
    await initNativeBridge();
    expect(window.Telegram).toBe(telegram);
    expect(getNativeBridgeHeaders()).toEqual({});

    const request = vi.fn().mockResolvedValue({ ok: true, text: async () => '{"ok":true}' });
    vi.stubGlobal('fetch', request);
    const { post } = await import('./api.js');
    await post('/api/account/create', { telegramId: 123 });
    expect(request.mock.calls[0][1].headers['X-Telegram-Init-Data']).toBe(initData);
  });
});
