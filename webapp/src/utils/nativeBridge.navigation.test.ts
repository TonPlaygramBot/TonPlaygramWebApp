import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }), exitApp: vi.fn(), get: vi.fn().mockResolvedValue({ value: null }) }));
vi.mock('@capacitor/app', () => ({ App: { addListener: mocks.addListener, exitApp: mocks.exitApp } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: mocks.get, set: vi.fn() } }));

describe('native Back installation', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });
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
