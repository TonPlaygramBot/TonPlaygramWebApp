import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { vi, expect, test, beforeEach, afterEach } from 'vitest';
vi.mock('./Room', () => ({ default: () => <div>3D board</div> }));
vi.mock('./onlineSession', () => ({ OnlineTabletopSession: class {} }));
vi.mock('../../utils/telegram.js', () => ({
  getTelegramFirstName: () => 'You'
}));
vi.mock('../../utils/sound.js', () => ({
  isGameMuted: () => true,
  getGameVolume: () => 0,
  setGameMuted: () => {}
}));
vi.mock('../../hooks/useTelegramBackButton.js', () => ({ default: () => {} }));
import Game from './Game';
import { TABLETOP_IDS } from './shared/catalog.mjs';
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
for (const id of TABLETOP_IDS)
  test(`${id}: playable AI controls and rules render`, async () => {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={[`/games/${id}?mode=ai&players=4`]}>
          <Game gameId={id} />
        </MemoryRouter>
      )
    );
    expect(container.textContent).toContain('Your turn');
    expect(container.querySelectorAll('.tt-player')).toHaveLength(4);
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Game rules"]')!
        .click()
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('.tt-help .tt-primary')!
        .click()
    );
    if (id === 'mosaicroyal')
      await act(async () =>
        container
          .querySelector<HTMLButtonElement>('.tt-tile-picker button')!
          .click()
      );
    const move =
      container.querySelector<HTMLButtonElement>('.tt-actions button');
    expect(move).not.toBeNull();
    const before = container.querySelector('.tt-history')?.textContent;
    await act(async () => move!.click());
    expect(container.querySelector('.tt-history')?.textContent).not.toBe(
      before
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
