import React, { act, forwardRef, useImperativeHandle, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import SpinGame from './SpinGame.jsx';
import RouletteMini from './RouletteMini.jsx';
import { rewardIdentity } from '../utils/rewardIdentity.js';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { claims, wheels, unmounts } = vi.hoisted(() => ({ claims: {}, wheels: [], unmounts: vi.fn() }));
vi.mock('../hooks/useServerSpinReward.js', () => ({ default: (kind, callback) => {
  claims[kind] = callback;
  return { identity: rewardIdentity(), ready: true, busy: false, remaining: 0, freeSpins: 0, showAd: false, begin() {}, claim() {}, closeAd() {} };
} }));
vi.mock('../utils/telegram.js', () => ({ getTelegramId: () => null }));
vi.mock('./SpinWheel.tsx', () => ({ default: forwardRef(function Wheel({ onFinish, setSpinning }, ref) {
  useImperativeHandle(ref, () => ({ spin: () => { wheels.push(onFinish); setSpinning(true); } }));
  useEffect(() => () => unmounts(), []);
  return <span>Wheel</span>;
}) }));
vi.mock('./RewardPopup.tsx', () => ({ default: ({ reward }) => reward === null ? null : <div>Reward {reward}</div> }));
vi.mock('./SpinRewardVideo.tsx', () => ({ default: () => null }));
vi.mock('../utils/coinConfetti', () => ({ default: vi.fn() }));
let root, host;
beforeEach(() => {
  vi.clearAllMocks(); wheels.length = 0; localStorage.clear(); localStorage.setItem('googleId', 'A');
  vi.useFakeTimers(); vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(); vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });
const render = async (element) => act(async () => root.render(element));
const switchToB = async (element) => { localStorage.setItem('googleId', 'B'); await render(element); };
test('SpinGame clears old animation, remounts wheel and ignores A completion after B starts', async () => {
  await render(<SpinGame />); act(() => claims.spin({ outcome: 400, amount: 400 }));
  const finishA = wheels.at(-1); expect(host.querySelector('button').disabled).toBe(true);
  await switchToB(<SpinGame />);
  expect(unmounts).toHaveBeenCalledTimes(1); expect(host.querySelector('button').disabled).toBe(false);
  act(() => claims.spin({ outcome: 800, amount: 800 })); const finishB = wheels.at(-1);
  act(() => finishA()); expect(host.textContent).not.toContain('Reward'); expect(host.querySelector('button').disabled).toBe(true);
  act(() => finishB()); expect(host.textContent).toContain('Reward 800');
});
test.each(['BONUS_X3', 'BOMB', 400])('SpinGame clears A bonus/bomb/reward state for %s', async (outcome) => {
  await render(<SpinGame />);
  act(() => claims.spin({ outcome, amount: 1200, bonusOutcomes: [400, 400, 400] }));
  act(() => wheels[0]());
  const oldBonusCallbacks = wheels.slice(1);
  await switchToB(<SpinGame />);
  act(() => oldBonusCallbacks.forEach((finish) => finish()));
  expect(host.querySelector('button').disabled).toBe(false);
  expect(host.textContent).not.toContain('Reward 1200'); expect(host.textContent).not.toContain('Try Again Later');
  expect(host.querySelectorAll('span').length).toBe(1);
});
test('Roulette cancels A timer and transition and lets B complete its own full animation', async () => {
  await render(<RouletteMini />); act(() => claims.roulette({ outcome: 32, amount: 400 }));
  const oldWheel = host.querySelector('[style*="conic-gradient"]');
  await act(async () => vi.advanceTimersByTime(2000));
  await switchToB(<RouletteMini />);
  expect(host.querySelector('button').disabled).toBe(false);
  expect(host.querySelector('[style*="conic-gradient"]')).not.toBe(oldWheel);
  act(() => claims.roulette({ outcome: 15, amount: 800 }));
  await act(async () => vi.advanceTimersByTime(2650));
  expect(host.textContent).not.toContain('Winning Number'); expect(host.querySelector('button').disabled).toBe(true);
  await act(async () => vi.advanceTimersByTime(2000));
  expect(host.textContent).toContain('Winning Number 15'); expect(host.textContent).not.toContain('Winning Number 32');
});
test('Roulette clears already displayed A result on account switch', async () => {
  await render(<RouletteMini />); act(() => claims.roulette({ outcome: 32, amount: 400 }));
  await act(async () => vi.advanceTimersByTime(4650)); expect(host.textContent).toContain('Winning Number 32');
  await switchToB(<RouletteMini />); expect(host.textContent).not.toContain('Winning Number');
  expect(host.querySelector('button').disabled).toBe(false);
});
