import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SnakeTurnPanel from './SnakeTurnPanel';

let root, host;
const defaults = {
  canRoll: true, rolling: false, moving: false, waiting: false,
  message: '', result: null, position: 0, finalTile: 100, seconds: 15,
  playerName: 'Opponent', onRoll: () => {}
};
function render(props = {}) {
  act(() => root.render(<SnakeTurnPanel {...defaults} {...props} />));
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it('shows single die pips and identifies multiple dice as a total', () => {
  render({ result: 5 });
  expect(host.querySelectorAll('.snake-die-pips circle')).toHaveLength(5);
  expect(host.querySelector('[role="img"]').getAttribute('aria-label')).toBe('Rolled 5');
  render({ result: 5, diceCount: 2 });
  expect(host.querySelectorAll('.snake-die-pips')).toHaveLength(0);
  expect(host.querySelector('.snake-roll-total').textContent).toBe('5Total');
  expect(host.querySelector('[role="img"]').getAttribute('aria-label')).toBe('Rolled 5 in total');
});

it('only exposes a clamped countdown during an actionable local turn', () => {
  render({ seconds: 99 });
  expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('15');
  expect(host.querySelector('.snake-turn-seconds').textContent).toBe('15s');
  render({ seconds: -2 });
  expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('0');
  render({ seconds: NaN });
  expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('0');
  render({ canRoll: false });
  expect(host.querySelector('[role="progressbar"]')).toBeNull();
  expect(host.querySelector('.snake-turn-seconds')).toBeNull();
  expect(host.textContent).toContain('Opponent’s turn');
});

it.each([
  [{ setup: true }, 'Choosing the first player'],
  [{ waiting: true }, 'Waiting for players'],
  [{ offline: true }, 'Reconnecting…'],
  [{ finished: true }, 'You finished!'],
  [{ position: 100 }, 'You finished!'],
  [{ rolling: true }, 'Rolling…'],
  [{ moving: true }, 'Moving…']
])('locks the roll action for %j', (props, status) => {
  const onRoll = vi.fn();
  render({ ...props, onRoll });
  expect(host.querySelector('.snake-roll-button').disabled).toBe(true);
  act(() => host.querySelector('.snake-roll-button').click());
  expect(onRoll).not.toHaveBeenCalled();
  expect(host.querySelector('[role="status"]').textContent).toContain(status);
});

it('uses the exact finish distance and does not prompt a finished player to roll zero', () => {
  render({ position: 97 });
  expect(host.textContent).toContain('Exact roll: 3 to finish');
  render({ position: 100 });
  expect(host.textContent).toContain('Finish reached');
  expect(host.textContent).not.toContain('0 to finish');
});

it('invokes the existing roll handler once for an actionable turn', () => {
  const onRoll = vi.fn();
  render({ onRoll });
  act(() => host.querySelector('.snake-roll-button').click());
  expect(onRoll).toHaveBeenCalledOnce();
});

it('shows compact progress on a normal turn without replacing the exact finish hint', () => {
  render({ position: 24 });
  expect(host.textContent).toContain('Tile 24/100 · 6 rolls again');
  render({ position: 98 });
  expect(host.textContent).toContain('Exact roll: 2 to finish');
  expect(host.textContent).not.toContain('Tile 98/100');
});
