import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { racingActivity } from './racingModeCore.mjs';

const lifecycle = vi.hoisted(() => ({ cityLeave: vi.fn(), raceLeave: vi.fn() }));
vi.mock('./BaseKartRoyale', () => ({ default: function Garage({ onCareer }) {
  useEffect(() => () => lifecycle.raceLeave(), []);
  return <button onClick={onCareer}>CAREER</button>;
} }));
vi.mock('../tirana-social/ExploreGame', () => ({ ExploreGame: function City({ onExit, onCareerJobs }) {
  useEffect(() => () => lifecycle.cityLeave(), []);
  return <section aria-label="Shared city"><button onClick={onCareerJobs}>CITY JOBS</button><button onClick={onExit}>GARAGE</button></section>;
} }));
vi.mock('./RacingCareerGame', () => ({ RacingCareerGame: ({ onExplore }) => <button onClick={onExplore}>RETURN TO CITY</button> }));
vi.mock('./RacingAtlas', () => ({ RacingAtlas: () => null }));
import KartRoyale from './KartRoyale';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  window.history.replaceState({}, '', '/');
  vi.clearAllMocks();
});
async function render(search = '') {
  window.history.replaceState({}, '', `/games/kartroyale${search}`);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<KartRoyale />));
}
async function click(label) {
  const button = [...host.querySelectorAll('button')].find(el => el.textContent === label);
  expect(button).toBeTruthy();
  await act(async () => button.click());
}
it('opens Career in the shared city and disposes each runtime when switching activities', async () => {
  await render();
  await click('CAREER');
  expect(host.querySelector('[aria-label="Shared city"]')).not.toBeNull();
  expect(lifecycle.raceLeave).toHaveBeenCalledOnce();
  await click('CITY JOBS');
  expect(lifecycle.cityLeave).toHaveBeenCalledOnce();
  await click('RETURN TO CITY');
  await click('GARAGE');
  expect(lifecycle.cityLeave).toHaveBeenCalledTimes(2);
  expect(host.textContent).toBe('CAREER');
});
it('opens career links in social city while preserving explicit solo-job links', async () => {
  await render('?mode=career');
  expect(host.querySelector('[aria-label="Shared city"]')).not.toBeNull();
  expect(racingActivity('?activity=city')).toBe('explore');
  expect(racingActivity('?activity=racing-career')).toBe('career');
});
it('never diverts a paid race or resume link into the social city', async () => {
  await render('?mode=online&activity=explore&tableId=paid-seat');
  expect(host.querySelector('[aria-label="Shared city"]')).toBeNull();
  for (const query of ['mode=online', 'tableId=paid-seat', 'code=ABC123']) {
    expect(racingActivity(`?${query}&activity=city&mode=career`)).toBe('race');
  }
});
