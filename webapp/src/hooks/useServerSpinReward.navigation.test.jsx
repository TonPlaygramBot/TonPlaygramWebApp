import React, { act } from 'react';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import useServerSpinReward from './useServerSpinReward.js';
import { spinRewardStatus, startServerSpin, claimServerSpin, hasPendingServerSpin } from '../utils/serverSpinRewards.js';
vi.mock('../utils/serverSpinRewards.js', () => ({ spinRewardStatus: vi.fn(), startServerSpin: vi.fn(), claimServerSpin: vi.fn(), hasPendingServerSpin: vi.fn() }));
let root, host, api;
const claimed = vi.fn();
function Harness() { api = useServerSpinReward('spin', claimed); return <span>{api.error}</span>; }
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
beforeEach(async () => {
  vi.clearAllMocks(); localStorage.clear(); hasPendingServerSpin.mockReturnValue(false);
  spinRewardStatus.mockResolvedValue({ pending: null, freeSpins: 0, nextSpinAt: 0 });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<Harness />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
test('server-selected spin waits for ad completion and credits before cosmetic animation', async () => {
  const grant = { id: 'same', outcome: 600, amount: 600, readyAt: Date.now() + 15000, nextSpinAt: Date.now() + 3600000, freeSpins: 0 };
  startServerSpin.mockResolvedValue(grant); claimServerSpin.mockResolvedValue({ ...grant, claimed: true, balance: 650 });
  await act(async () => api.begin());
  expect(api.showAd).toBe(true); expect(claimServerSpin).not.toHaveBeenCalled();
  await act(async () => api.claim());
  expect(claimServerSpin).toHaveBeenCalledWith('spin', 'same'); expect(claimed).toHaveBeenCalledTimes(1); expect(api.showAd).toBe(false);
});
test('close and reopen keeps the same server spin, never client random or amount', async () => {
  const grant = { id: 'stable', readyAt: Date.now() + 15000 };
  startServerSpin.mockResolvedValue(grant);
  await act(async () => api.begin()); act(() => api.closeAd());
  expect(claimServerSpin).not.toHaveBeenCalled();
  await act(async () => api.begin());
  expect(api.showAd).toBe(true); expect(startServerSpin).toHaveBeenNthCalledWith(2, 'spin');
});
test('failed claim retains operation for safe retry, duplicate clicks are ignored', async () => {
  const grant = { id: 'retry', readyAt: 0, nextSpinAt: Date.now() + 3600000 };
  startServerSpin.mockResolvedValue(grant); claimServerSpin.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...grant, claimed: true });
  await act(async () => api.begin()); expect(api.error).toBe('offline');
  await act(async () => { const first = api.begin(); const duplicate = api.begin(); await Promise.all([first, duplicate]); });
  expect(claimServerSpin).toHaveBeenCalledTimes(2); expect(claimed).toHaveBeenCalledTimes(1);
});
test('a lost claim response remains retryable after reload even during cooldown', async () => {
  hasPendingServerSpin.mockReturnValue(true);
  spinRewardStatus.mockResolvedValue({ pending: null, nextSpinAt: Date.now() + 3600000, freeSpins: 0 });
  act(() => root.unmount()); root = createRoot(host); await act(async () => root.render(<Harness />));
  expect(api.ready).toBe(true);
});
test('unmount while claim is pending does not animate or update detached component', async () => {
  startServerSpin.mockResolvedValue({ id: 'unmount', readyAt: 0 });
  let resolve; claimServerSpin.mockReturnValue(new Promise((r) => { resolve = r; }));
  let operation; act(() => { operation = api.begin(); }); await flush();
  act(() => root.unmount()); root = createRoot(host);
  await act(async () => { resolve({ claimed: true }); await operation; });
  expect(claimed).not.toHaveBeenCalled();
});
test('late initial status cannot erase the grant already reserved by a click', async () => {
  let resolveStatus;
  spinRewardStatus.mockReturnValue(new Promise((resolve) => { resolveStatus = resolve; }));
  act(() => root.unmount()); root = createRoot(host); await act(async () => root.render(<Harness />));
  startServerSpin.mockResolvedValue({ id: 'new-grant', readyAt: Date.now() + 15000 });
  claimServerSpin.mockResolvedValue({ id: 'new-grant', claimed: true });
  await act(async () => api.begin());
  await act(async () => resolveStatus({ pending: null, freeSpins: 0, nextSpinAt: 0 }));
  await act(async () => api.claim());
  expect(claimServerSpin).toHaveBeenCalledWith('spin', 'new-grant');
});

test('claim callback stays stable across clock and status rerenders for ad timer', async () => {
  const before = api.claim;
  startServerSpin.mockResolvedValue({ id: 'ad', readyAt: Date.now() + 15000 });
  await act(async () => api.begin());
  expect(api.claim).toBe(before);
});
test('Google account switch during claim suppresses old callback and loads new account', async () => {
  localStorage.setItem('googleId', 'A');
  await act(async () => window.dispatchEvent(new Event('social-auth-changed')));
  startServerSpin.mockResolvedValue({ id: 'a', readyAt: 0 });
  let resolveA; claimServerSpin.mockReturnValueOnce(new Promise((r) => { resolveA = r; }));
  let operation; act(() => { operation = api.begin(); }); await flush();
  await act(async () => {
    localStorage.setItem('googleId', 'B');
    resolveA({ id: 'a', claimed: true }); await operation;
    expect(claimed).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('social-auth-changed'));
  });
  expect(api.busy).toBe(false); expect(api.showAd).toBe(false);
  startServerSpin.mockResolvedValue({ id: 'b', readyAt: 0 });
  claimServerSpin.mockResolvedValue({ id: 'b', claimed: true });
  await act(async () => api.begin());
  expect(claimed).toHaveBeenCalledExactlyOnceWith({ id: 'b', claimed: true });
});
test('free spin display event reloads server count without starting or claiming', async () => {
  spinRewardStatus.mockResolvedValue({ pending: null, freeSpins: 2, nextSpinAt: Date.now() + 10000 });
  await act(async () => window.dispatchEvent(new Event('serverSpinRewardsUpdated')));
  expect(api.freeSpins).toBe(2);
  expect(startServerSpin).not.toHaveBeenCalled(); expect(claimServerSpin).not.toHaveBeenCalled();
});
test('old account start response cannot open an ad or replace new pending grant', async () => {
  localStorage.setItem('googleId', 'A');
  await act(async () => window.dispatchEvent(new Event('social-auth-changed')));
  let resolveA; startServerSpin.mockReturnValueOnce(new Promise((r) => { resolveA = r; }));
  let operation; act(() => { operation = api.begin(); }); await flush();
  await act(async () => {
    localStorage.setItem('googleId', 'B'); window.dispatchEvent(new Event('accountUpdated'));
  });
  startServerSpin.mockResolvedValue({ id: 'b-pending', readyAt: Date.now() + 15000 });
  await act(async () => api.begin());
  await act(async () => { resolveA({ id: 'a-pending', readyAt: Date.now() + 15000 }); await operation; });
  claimServerSpin.mockResolvedValue({ id: 'b-pending', claimed: true });
  await act(async () => api.claim());
  expect(claimServerSpin).toHaveBeenCalledWith('spin', 'b-pending');
});
test('free spin refresh during a claim is deferred and not lost', async () => {
  startServerSpin.mockResolvedValue({ id: 'spin', readyAt: 0 });
  let resolve; claimServerSpin.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  let operation; act(() => { operation = api.begin(); }); await flush();
  spinRewardStatus.mockResolvedValue({ pending: null, freeSpins: 2, nextSpinAt: Date.now() + 10000 });
  act(() => window.dispatchEvent(new Event('serverSpinRewardsUpdated')));
  await act(async () => { resolve({ claimed: true, freeSpins: 0 }); await operation; });
  expect(api.freeSpins).toBe(2);
});
