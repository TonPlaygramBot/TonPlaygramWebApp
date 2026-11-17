import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../utils/nativeBridge', () => ({ getNativeBridgeHeaders: () => ({}) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
let container;
let observe;
let Notice;
const headers = (value) => ({ 'X-Telegram-Init-Data': value });

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  window.Telegram = { WebApp: { initData: 'expired-signed-session', close: vi.fn() } };
  ({ observeTelegramSessionResponse: observe } = await import('../utils/telegramSessionRecovery.js'));
  Notice = (await import('./TelegramSessionNotice.jsx')).default;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete window.Telegram;
  vi.unstubAllGlobals();
});
const mount = () => act(async () => root.render(<React.StrictMode><Notice /></React.StrictMode>));

it('catches early rejections, gives recovery instructions, never exposes credentials or closes a game', async () => {
  observe({ status: 401 }, headers('expired-signed-session'));
  await mount();
  expect(container.querySelector('[role="status"]')).not.toBeNull();
  expect(container.textContent).toContain('open TonPlayGram again from the bot');
  expect(container.textContent).not.toContain('expired-signed-session');
  expect(window.Telegram.WebApp.close).not.toHaveBeenCalled();
});

it('dismisses repeated failures and shows a new session failure without navigating', async () => {
  await mount();
  const url = window.location.href;
  await act(async () => observe({ status: 401 }, headers('expired-signed-session')));
  await act(async () => container.querySelector('button').click());
  await act(async () => {
    observe({ status: 401 }, headers('expired-signed-session'));
    window.dispatchEvent(new Event('focus'));
  });
  expect(container.textContent).toBe('');
  window.Telegram.WebApp.initData = 'new-session';
  await act(async () => observe({ status: 401 }, headers('new-session')));
  expect(container.textContent).toContain('Renew your Telegram session');
  expect(window.location.href).toBe(url);
});

it('removes old notice after a new Telegram launch credential and ignores stale in-flight failures', async () => {
  await mount();
  await act(async () => observe({ status: 401 }, headers('expired-signed-session')));
  window.Telegram.WebApp.initData = 'new-session';
  await act(async () => window.dispatchEvent(new Event('focus')));
  await act(async () => observe({ status: 401 }, headers('expired-signed-session')));
  expect(container.textContent).toBe('');
});

it('does not announce network, forbidden, rate-limit, success or standalone Google failures', async () => {
  await mount();
  await act(async () => {
    for (const status of [200, 403, 429, 502]) observe({ status }, headers('expired-signed-session'));
    observe({ status: 401 }, { 'X-Google-Id-Token': 'google-credential' });
  });
  expect(container.textContent).toBe('');
});

it('preserves rejected credentials and account state, and does not replay a rejected mutation', async () => {
  await mount();
  localStorage.setItem('accountId', 'existing-account');
  const request = vi.fn().mockResolvedValue({ status: 401, ok: false, text: async () => '{"error":"unauthorized"}' });
  vi.stubGlobal('fetch', request);
  const { post } = await import('../utils/api.js');
  let result;
  await act(async () => { result = await post('/api/profile/transaction', { amount: 10 }); });
  expect(result).toEqual({ error: 'unauthorized' });
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][1].headers['X-Telegram-Init-Data']).toBe('expired-signed-session');
  expect(window.Telegram.WebApp.initData).toBe('expired-signed-session');
  expect(localStorage.getItem('accountId')).toBe('existing-account');
  expect(container.textContent).toContain('Renew your Telegram session');
  // Public success must not be mistaken for authenticated session renewal.
  await act(async () => observe({ status: 200, ok: true }, headers('expired-signed-session')));
  expect(container.textContent).toContain('Renew your Telegram session');
});
