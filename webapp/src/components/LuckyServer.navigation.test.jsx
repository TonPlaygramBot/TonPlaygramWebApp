import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import LuckyNumber from './LuckyNumber.jsx';
import { post, updateBalance, addTransaction } from '../utils/api.js';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('../utils/api.js', () => ({ post: vi.fn(), updateBalance: vi.fn(), addTransaction: vi.fn() }));
vi.mock('../utils/telegram.js', () => ({ getTelegramId: () => null }));
vi.mock('./DiceRoller.jsx', () => ({ default: ({ trigger, forcedValues, onRollEnd }) => {
  useEffect(() => { if (trigger) onRollEnd(forcedValues); }, [trigger]);
  return <span data-testid="dice">{JSON.stringify(forcedValues)}</span>;
} }));
vi.mock('./AdModal.tsx', () => ({ default: ({ open, onComplete, onClose }) => open ? <div><button onClick={onComplete}>Finish ad</button><button onClick={onClose}>Close ad</button></div> : null }));
vi.mock('./CardSpinner.jsx', () => ({ default: ({ forcedOutcome, onFinish }) => <button onClick={() => onFinish(999999)}>Finish card {forcedOutcome}</button> }));
vi.mock('./LoginOptions.jsx', () => ({ default: () => null }));
vi.mock('./TikTokTaskVideo.jsx', () => ({ default: () => null }));
vi.mock('../utils/coinConfetti', () => ({ default: vi.fn() }));
const grant = { id: 'one', kind: 'lucky', outcome: 800, baseOutcome: 400, amount: 800, dice: [3, 5], cardIndex: 6, suit: 'hearts', readyAt: Date.now() + 15000, nextSpinAt: Date.now() + 14400000, freeSpins: 0, bonusOutcomes: [] };
let root, host, outcome, failClaim, refresh;
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); outcome = { ...grant }; failClaim = false;
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  refresh = vi.fn(); window.addEventListener('serverSpinRewardsUpdated', refresh);
  post.mockImplementation(async (path) => {
    if (path === '/api/lucky-daily/claim') return { claimed: true, balance: 100, alreadyClaimed: true };
    if (path.endsWith('/status')) return { pending: null, nextSpinAt: 0, freeSpins: 0 };
    if (path.endsWith('/start')) return outcome;
    if (failClaim) return { error: 'offline' };
    return { ...outcome, claimed: true, balance: 300 };
  });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); window.removeEventListener('serverSpinRewardsUpdated', refresh); vi.restoreAllMocks(); });
const render = async () => act(async () => root.render(<LuckyNumber />));
const click = async (text) => act(async () => [...host.querySelectorAll('button')].find((b) => b.textContent.includes(text)).click());
const begin = async () => act(async () => host.querySelector('[aria-label="Roll Lucky Card dice"]').click());
test('confirmed claim precedes forced dice/card; callback cannot alter amount or pay again', async () => {
  localStorage.setItem('luckyRollTs', String(Date.now()));
  await render(); await begin();
  expect(host.querySelector('[data-testid="dice"]').textContent).toBe('[]');
  expect(post.mock.calls.filter(([path]) => path.endsWith('/claim') && !path.includes('daily'))).toHaveLength(0);
  await click('Finish ad');
  expect(host.querySelector('[data-testid="dice"]').textContent).toBe('[3,5]');
  expect(host.textContent).toContain('Finish card 400');
  await click('Finish card');
  expect(host.textContent).toContain('800'); expect(host.textContent).not.toContain('999999');
  expect(updateBalance).not.toHaveBeenCalled(); expect(addTransaction).not.toHaveBeenCalled();
  expect(post.mock.calls.filter(([path]) => path === '/api/spin-rewards/claim')).toHaveLength(1);
});
test('close, reopen and failed claim recover same server grant without animating before confirmation', async () => {
  await render(); await begin(); await click('Close ad'); await begin();
  failClaim = true; await click('Finish ad');
  expect(host.querySelector('[data-testid="dice"]').textContent).toBe('[]');
  expect(host.textContent).toContain('Retry Lucky reward');
  failClaim = false; outcome.readyAt = 0; await click('Retry Lucky reward');
  expect(host.querySelector('[data-testid="dice"]').textContent).toBe('[3,5]');
  expect(post.mock.calls.filter(([path]) => path.endsWith('/start')).map(([, body]) => body.requestId).every((id, i, ids) => i === 0 || id === outcome.id)).toBe(true);
});
test.each(['FREE_SPIN', 'BONUS_X3'])('%s has no local entitlement or second payment', async (value) => {
  outcome = { ...grant, outcome: value, baseOutcome: value, amount: value === 'BONUS_X3' ? 600 : 0, bonusOutcomes: value === 'BONUS_X3' ? [100, 200, 300] : [] };
  localStorage.setItem('freeSpins', '999'); localStorage.setItem('bonusX3', 'true');
  await render(); await begin(); await click('Finish ad'); await click('Finish card');
  expect(refresh).toHaveBeenCalledTimes(value === 'FREE_SPIN' ? 1 : 0);
  expect(host.textContent).toContain(value === 'BONUS_X3' ? '100 + 200 + 300 = 600 TPC credited' : '2 server-issued free spins');
  expect(localStorage.getItem('freeSpins')).toBe('999'); expect(localStorage.getItem('bonusX3')).toBe('true');
  expect(post.mock.calls.filter(([path]) => path === '/api/spin-rewards/claim')).toHaveLength(1);
});
