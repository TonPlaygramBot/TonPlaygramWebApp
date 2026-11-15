import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { racingActivity } from './racingModeCore.mjs';

const lifecycle = vi.hoisted(() => ({ careerLeave: vi.fn(), raceLeave: vi.fn(), explore: vi.fn() }));
vi.mock('./BaseKartRoyale', () => ({ default: function Garage({ onCareer, onFreeRoam }) {
  useEffect(() => () => lifecycle.raceLeave(), []);
  return <><button onClick={onCareer}>CAREER JOBS</button>{onFreeRoam && <button onClick={onFreeRoam}>FREE ROAM</button>}</>;
} }));
vi.mock('../tirana-social/ExploreGame', () => ({ ExploreGame: lifecycle.explore }));
vi.mock('./RacingCareerGame', () => ({ RacingCareerGame: function Career({ onExit, onExplore }) {
  useEffect(() => () => lifecycle.careerLeave(), []);
  return <section aria-label="Career jobs"><button onClick={onExit}>GARAGE</button>{onExplore && <button onClick={onExplore}>RETURN TO CITY</button>}</section>;
} }));
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
it('keeps career jobs reachable and returns to the garage without a city shortcut', async () => {
  await render();
  expect(host.textContent).toBe('CAREER JOBS');
  await click('CAREER JOBS');
  expect(host.querySelector('[aria-label="Career jobs"]')).not.toBeNull();
  expect(host.textContent).not.toContain('RETURN TO CITY');
  expect(lifecycle.raceLeave).toHaveBeenCalledOnce();
  await click('GARAGE');
  expect(lifecycle.careerLeave).toHaveBeenCalledOnce();
  expect(host.textContent).toBe('CAREER JOBS');
  expect(lifecycle.explore).not.toHaveBeenCalled();
});
it.each(['?mode=free', '?mode=career', '?activity=explore', '?activity=city', '?mode=ai&activity=explore&exploreRoom=old-room'])('opens retired city link %s in the garage', async (search) => {
  await render(search);
  expect(racingActivity(search)).toBe('race');
  expect(host.textContent).toBe('CAREER JOBS');
  expect(lifecycle.explore).not.toHaveBeenCalled();
});
it('preserves explicit career job links', async () => {
  await render('?activity=racing-career');
  expect(host.querySelector('[aria-label="Career jobs"]')).not.toBeNull();
  await click('GARAGE');
  expect(host.textContent).toBe('CAREER JOBS');
});
it.each(['mode=online', 'tableId=paid-seat', 'code=ABC123'])('keeps race/resume parameter %s ahead of other activities', async (query) => {
  await render(`?${query}&activity=racing-career`);
  expect(host.textContent).toBe('CAREER JOBS');
  expect(racingActivity(`?${query}&activity=city&mode=career`)).toBe('race');
  expect(lifecycle.explore).not.toHaveBeenCalled();
});
