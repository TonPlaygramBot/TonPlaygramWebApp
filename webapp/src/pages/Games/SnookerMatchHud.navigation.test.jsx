import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import SnookerMatchHud from './SnookerMatchHud';
import { poolRoyalHudLayout, POOL_AVATAR_SIZE_PX, POOL_SPIN_DIAMETER_PX } from './poolRoyalHudLayout';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
afterEach(() => { if (root) act(() => root.unmount()); host?.remove(); root = null; });
const defaults = {
  player: { name: 'Player with a long name', score: 42 },
  opponent: { name: 'Opponent with a long name', score: 18 },
  playerTurn: true, shooting: false, finished: false, inHand: false,
  next: 'red', currentBreak: 8, timer: 9, mode: 'Snooker Royal',
  portrait: true, avatarLayout: poolRoyalHudLayout({ bottom: 42 }).avatars
};
function render(props = {}) {
  if (!root) { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); }
  act(() => root.render(<SnookerMatchHud {...defaults} {...props} />));
}
describe('Snooker HUD matches the Pool avatar layout', () => {
  it.each([320, 390, 430, 844])('reserves the same spin bounds at %ipx', width => {
    const portrait = width < 500;
    for (const uiScale of [0.7, 1]) {
      const layout = poolRoyalHudLayout({ uiScale, portrait, bottom: 42 });
      render({ portrait, avatarLayout: layout.avatars });
      const hud = host.querySelector('[data-snooker-avatar-hud]');
      expect(hud.style.left).toBe(`${layout.avatars.left}px`);
      expect(hud.style.right).toBe(`${layout.avatars.right}px`);
      expect(hud.style.bottom).toBe('42px');
      const hudRight = width - layout.avatars.right;
      const spinLeft = width - layout.spin.right - POOL_SPIN_DIAMETER_PX * uiScale * 0.88;
      expect(spinLeft - hudRight).toBeCloseTo(12);
      expect(hudRight - layout.avatars.left).toBeGreaterThan(POOL_AVATAR_SIZE_PX * 2 + 40);
      expect([...hud.querySelectorAll('img')].every(img => img.width === POOL_AVATAR_SIZE_PX)).toBe(true);
      expect(hud.querySelector('[data-snooker-player="1"]').className).not.toContain('flex-row-reverse');
    }
  });
  it('keeps seat-mapped scores below each avatar and updates them across turns', () => {
    render();
    const first = host.querySelector('[data-snooker-player="0"]');
    expect(first.textContent).toContain('42 points');
    expect(first.querySelector('img').className).toContain('ring-2');
    render({ player: { name: 'Seat B', score: 57 }, opponent: { name: 'Seat A', score: 23 }, playerTurn: false });
    expect(first.textContent).toContain('57 points');
    expect(first.querySelector('img').className).not.toContain('ring-2');
    expect(host.querySelector('[data-snooker-player="1"]').textContent).toContain('23 points');
    expect(host.querySelector('[data-snooker-player="1"] img').className).toContain('ring-2');
    expect(host.querySelector('[role="status"]').textContent).toBe("Seat A's visit");
  });
  it('preserves status, break and target, hides stale clock during shots and completion', () => {
    render();
    expect(host.textContent).toContain('Break 8');
    expect(host.textContent).toContain('Red · 1');
    expect(host.querySelector('[aria-label="9 seconds remaining"]')).not.toBeNull();
    render({ shooting: true });
    expect(host.querySelector('[role="status"]').textContent).toBe('Balls in play');
    expect(host.querySelector('[aria-label="9 seconds remaining"]')).toBeNull();
    expect(host.querySelector('[data-snooker-avatar-hud]')).not.toBeNull();
    render({ inHand: true });
    expect(host.textContent).toContain('Place cue ball in the D');
    render({ next: 'yellow/green/brown' });
    expect(host.textContent).toContain('Choose a colour');
    render({ finished: true });
    expect(host.textContent).toContain('Frame complete');
    expect(host.querySelector('[aria-label="9 seconds remaining"]')).toBeNull();
    expect([...host.querySelectorAll('img')].every(img => !img.className.includes('ring-2'))).toBe(true);
  });
});
