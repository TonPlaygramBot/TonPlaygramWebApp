import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import DiceRoller from './DiceRoller.jsx';
import CardSpinner from './CardSpinner.jsx';
vi.mock('./Dice.jsx', () => ({ default: () => null }));
vi.mock('../utils/socket.js', () => ({ socket: { emit: vi.fn() } }));
vi.mock('../utils/diceAudio.js', () => ({ createDiceRollAudio: () => ({ pause() {}, play: () => Promise.resolve() }) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
beforeEach(() => {
  vi.useFakeTimers(); vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(); vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });
test('DiceRoller explicit faces finish exactly once; invalid explicit dice never randomize', async () => {
  const finish = vi.fn();
  await act(async () => root.render(<DiceRoller forcedValues={[2, 6]} onRollEnd={finish} durationMs={100} muted />));
  act(() => { host.querySelector('button').click(); host.querySelector('button').click(); });
  await act(async () => vi.advanceTimersByTime(100)); expect(finish).toHaveBeenCalledExactlyOnceWith([2, 6]);
  await act(async () => root.render(<DiceRoller forcedValues={[0, 7]} onRollEnd={finish} durationMs={100} muted />));
  act(() => host.querySelector('button').click()); await act(async () => vi.advanceTimersByTime(100));
  expect(finish).toHaveBeenCalledTimes(1);
});
test('CardSpinner uses explicit base outcome, callback changes do not restart timer', async () => {
  const first = vi.fn(), second = vi.fn();
  await act(async () => root.render(<CardSpinner forcedOutcome={400} trigger={1} onFinish={first} />));
  await act(async () => vi.advanceTimersByTime(1500));
  await act(async () => root.render(<CardSpinner forcedOutcome={400} trigger={1} onFinish={second} />));
  await act(async () => vi.advanceTimersByTime(1500));
  expect(first).not.toHaveBeenCalled(); expect(second).toHaveBeenCalledExactlyOnceWith(400);
});
test('CardSpinner invalid supplied outcome has no fallback or completion', async () => {
  const finish = vi.fn();
  await act(async () => root.render(<CardSpinner forcedOutcome={999999} trigger={1} onFinish={finish} />));
  await act(async () => vi.advanceTimersByTime(5000)); expect(finish).not.toHaveBeenCalled();
});
