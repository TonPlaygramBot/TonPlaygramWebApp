import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import WallNotifications from './WallNotifications';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const settings = {
  accountId: 'reader',
  publicKey:
    'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  telegramAvailable: true,
  telegramEnabled: false
};
describe('wall notification consent', () => {
  let root: Root, container: HTMLDivElement;
  const permission = vi.fn();
  const subscribe = vi.fn();
  const unsubscribe = vi.fn();
  const browserSubscription = {
    endpoint: 'https://fcm.googleapis.com/test',
    toJSON: () => ({
      endpoint: 'https://fcm.googleapis.com/test',
      keys: { p256dh: 'key', auth: 'auth' }
    }),
    unsubscribe
  };
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    permission.mockReset().mockResolvedValue('granted');
    subscribe.mockReset().mockResolvedValue(browserSubscription);
    unsubscribe.mockReset().mockResolvedValue(true);
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: permission
    });
    vi.stubGlobal('PushManager', class {});
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn(async () => ({
          active: {},
          pushManager: { getSubscription: async () => null, subscribe }
        }))
      }
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => ({
        ok: true,
        json: async () =>
          init?.method === 'PUT'
            ? { enabled: JSON.parse(init.body).enabled }
            : settings
      }))
    );
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (navigator as any).serviceWorker;
  });
  const open = async () => {
    await act(async () => root.render(<WallNotifications />));
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Wall notifications"]')!
        .click()
    );
  };
  const toggle = async (text: string) => {
    const button = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="switch"]')
    ).find((button) => button.textContent?.includes(text))!;
    await act(async () => button.click());
    return button;
  };
  it('does not prompt or subscribe until the user selects browser notifications', async () => {
    await open();
    expect(permission).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    const button = await toggle('This browser');
    expect(permission).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true })
    );
    expect(button.getAttribute('aria-checked')).toBe('true');
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          ([url, init]) =>
            String(url).endsWith('/browser') && init?.method === 'PUT'
        )
    ).toBe(true);
  });
  it('does not register a browser subscription when permission is denied', async () => {
    permission.mockResolvedValue('denied');
    await open();
    const button = await toggle('This browser');
    expect(button.getAttribute('aria-checked')).toBe('false');
    expect(subscribe).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Notifications are blocked');
  });
  it('does not report success and removes a new subscription if server persistence fails', async () => {
    vi.mocked(fetch).mockImplementation(
      async (_url, init) =>
        ({
          ok: init?.method !== 'PUT',
          json: async () =>
            init?.method === 'PUT' ? { error: 'Please retry' } : settings
        }) as Response
    );
    await open();
    const button = await toggle('This browser');
    expect(button.getAttribute('aria-checked')).toBe('false');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Please retry');
  });
  it('enables and disables Telegram independently without asking browser permission', async () => {
    await open();
    const button = await toggle('Telegram');
    expect(button.getAttribute('aria-checked')).toBe('true');
    await toggle('Telegram');
    expect(button.getAttribute('aria-checked')).toBe('false');
    expect(permission).not.toHaveBeenCalled();
  });
  it('explains unsupported mobile browsers without crashing', async () => {
    vi.stubGlobal('isSecureContext', false);
    await open();
    const button = await toggle('This browser');
    expect(button.disabled).toBe(true);
    expect(container.textContent).toContain('Home Screen');
    expect(permission).not.toHaveBeenCalled();
  });
});
