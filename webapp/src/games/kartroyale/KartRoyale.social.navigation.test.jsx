import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { racingActivity } from './racingModeCore.mjs';

const lifecycle = vi.hoisted(() => ({ careerLeave: vi.fn(), raceLeave: vi.fn(), explore: vi.fn() }));
vi.mock('./BaseKartRoyale', () => ({ default: function Garage({ onCareer, onFreeRoam }) {
  useEffect(() => () => lifecycle.raceLeave(), []);
  return <>RACE GARAGE{onCareer && <button onClick={onCareer}>CAREER JOBS</button>}{onFreeRoam && <button onClick={onFreeRoam}>FREE ROAM</button>}</>;
} }));
vi.mock('../tirana-social/ExploreGame', () => ({ ExploreGame: lifecycle.explore }));
vi.mock('./StreetCareerGame', () => ({ StreetCareerGame: function Career({ onExit, onExplore }) {
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
it.each(['', '?mode=free', '?mode=career', '?activity=explore', '?activity=city', '?activity=racing-career', '?raceFormat=combat', '?raceFormat=trial', '?raceFormat=championship', '?mode=ai&activity=explore&exploreRoom=old-room'])('opens current or retired link %s in the race garage', async (search) => {
  await render(search);
  expect(racingActivity(search)).toBe('race');
  expect(host.textContent).toContain('RACE GARAGE');
  expect(host.textContent).toContain('CAREER JOBS');
  expect(host.querySelector('[aria-label="Career jobs"]')).toBeNull();
  expect(lifecycle.explore).not.toHaveBeenCalled();
});
it.each(['mode=online', 'tableId=paid-seat', 'code=ABC123'])('keeps race/resume parameter %s ahead of retired activities', async (query) => {
  await render(`?${query}&activity=racing-career`);
  expect(host.textContent).toContain('RACE GARAGE');
  expect(host.textContent).toContain('CAREER JOBS');
  expect(window.location.search).toContain(query);
  expect(lifecycle.explore).not.toHaveBeenCalled();
});

it('enters explicit career and returns to garage without mounting free roam',async()=>{
 await render();await click('CAREER JOBS');expect(host.querySelector('[aria-label="Career jobs"]')).not.toBeNull();expect(lifecycle.raceLeave).toHaveBeenCalledOnce();await click('GARAGE');expect(host.textContent).toContain('RACE GARAGE');expect(lifecycle.careerLeave).toHaveBeenCalledOnce();expect(lifecycle.explore).not.toHaveBeenCalled();
});
