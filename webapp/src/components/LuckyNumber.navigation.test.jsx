import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import LuckyNumber from './LuckyNumber.jsx';
import { getTelegramId } from '../utils/telegram.js';
import { post, getWalletBalance, updateBalance, addTransaction } from '../utils/api.js';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('../utils/api.js', () => ({ post: vi.fn(), getWalletBalance: vi.fn(), updateBalance: vi.fn(), addTransaction: vi.fn() }));
vi.mock('../utils/telegram.js', () => ({ getTelegramId: vi.fn() }));
vi.mock('./DiceRoller.jsx', () => ({ default: () => <div>Dice gameplay</div> }));
vi.mock('./AdModal.tsx', () => ({ default: () => null }));
vi.mock('./CardSpinner.jsx', () => ({ default: () => null }));
vi.mock('./LoginOptions.jsx', () => ({ default: () => null }));
vi.mock('./TikTokTaskVideo.jsx', () => ({ default: () => null }));
vi.mock('../utils/coinConfetti', () => ({ default: vi.fn() }));
let host, root, events;
const receipt = { claimed: true, amount: 100, balance: 350, day: '2026-11-17', nextClaimAt: 1794960000000, alreadyClaimed: false };
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); getTelegramId.mockReturnValue('123');
  post.mockResolvedValue(receipt);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  events = vi.fn(); window.addEventListener('walletBalanceUpdated', events);
});
afterEach(() => { act(() => root.unmount()); host.remove(); window.removeEventListener('walletBalanceUpdated', events); });
const render = async (node = <LuckyNumber />) => { await act(async () => root.render(node)); };
test('mount claims through signed API without client amount, identity or date and preserves dice', async () => {
  localStorage.setItem('luckyCard1Claimed', new Date().toISOString().slice(0, 10));
  await render();
  expect(post).toHaveBeenCalledExactlyOnceWith('/api/lucky-daily/claim', {});
  expect(host.textContent).toContain('Daily 100 TPC claimed');
  expect(host.textContent).toContain('Dice gameplay');
  expect(events).toHaveBeenCalledTimes(1);
  expect(events.mock.calls[0][0].detail).toEqual({ balance: 350 });
  expect(getWalletBalance).not.toHaveBeenCalled(); expect(updateBalance).not.toHaveBeenCalled(); expect(addTransaction).not.toHaveBeenCalled();
});
test('auth failure has visible retry, no wallet update, then confirms server result', async () => {
  post.mockResolvedValueOnce({ error: 'Unauthorized' });
  await render();
  expect(host.querySelector('[role="alert"]').textContent).toContain('sign in and retry');
  expect(events).not.toHaveBeenCalled();
  const retry = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Retry daily reward');
  await act(async () => { retry.click(); retry.click(); });
  expect(post).toHaveBeenCalledTimes(2); expect(events).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[role="alert"]')).toBeNull();
});
test('ambiguous network result can retry already-claimed receipt without local balance arithmetic', async () => {
  post.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...receipt, alreadyClaimed: true });
  await render(); expect(events).not.toHaveBeenCalled();
  await act(async () => [...host.querySelectorAll('button')].find((button) => button.textContent === 'Retry daily reward').click());
  expect(host.textContent).toContain('already claimed today');
  expect(events.mock.calls[0][0].detail.balance).toBe(350);
  expect(localStorage.getItem('luckyCard1Claimed')).toBeNull();
});
test('unconfirmed response never announces or dispatches success', async () => {
  post.mockResolvedValue({ balance: 350 }); await render();
  expect(events).not.toHaveBeenCalled(); expect(host.querySelector('[role="alert"]')).not.toBeNull();
});
test('unmount ignores late receipt and Strict Mode only announces active receipt', async () => {
  let resolve;
  post.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  await render(<StrictMode><LuckyNumber /></StrictMode>);
  expect(post).toHaveBeenCalledTimes(2); expect(events).toHaveBeenCalledTimes(1);
  await act(async () => resolve(receipt)); expect(events).toHaveBeenCalledTimes(1);
  let late;
  post.mockImplementationOnce(() => new Promise((r) => { late = r; }));
  await render(null); await render(); await render(null);
  await act(async () => late(receipt)); expect(events).toHaveBeenCalledTimes(1);
});

test('Google A to B in flight suppresses A before rerender and claims for B', async () => {
  getTelegramId.mockReturnValue(null);
  localStorage.setItem('googleId', 'A'); localStorage.setItem('accountId', 'account-A');
  let resolveA, resolveB;
  post.mockImplementationOnce(() => new Promise((r) => { resolveA = r; }))
    .mockImplementationOnce(() => new Promise((r) => { resolveB = r; }));
  await render();
  await act(async () => {
    localStorage.setItem('googleId', 'B'); localStorage.setItem('accountId', 'account-B');
    // Resolve before React rerenders, even before the notification is delivered.
    resolveA({ ...receipt, balance: 999 });
    await Promise.resolve();
    expect(events).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('social-auth-changed'));
  });
  expect(post).toHaveBeenCalledTimes(2);
  await act(async () => resolveB({ ...receipt, balance: 200 }));
  expect(events).toHaveBeenCalledTimes(1);
  expect(events.mock.calls[0][0].detail).toEqual({ balance: 200 });
});
test.each(['accountUpdated', 'telegramAuthUpdated', 'googleProfileUpdated', 'storage'])('%s starts a new account claim and ignores old response', async (eventName) => {
  getTelegramId.mockReturnValue(null);
  localStorage.setItem('googleId', 'A');
  let resolveA;
  post.mockImplementationOnce(() => new Promise((r) => { resolveA = r; }));
  await render();
  await act(async () => {
    localStorage.setItem('googleId', 'B');
    window.dispatchEvent(eventName === 'storage' ? new StorageEvent('storage', { key: 'googleId' }) : new Event(eventName));
  });
  await act(async () => resolveA({ ...receipt, balance: 999 }));
  expect(post).toHaveBeenCalledTimes(2);
  expect(events).toHaveBeenCalledTimes(1);
  expect(events.mock.calls[0][0].detail.balance).toBe(350);
});
