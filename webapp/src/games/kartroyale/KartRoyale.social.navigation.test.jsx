import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { racingActivity } from './racingModeCore.mjs';

const lifecycle = vi.hoisted(() => ({ careerLeave: vi.fn(), raceLeave: vi.fn() }));
vi.mock('./BaseKartRoyale', () => ({ default: function Garage({ onCareer }) {
  useEffect(() => () => lifecycle.raceLeave(), []);
  return <><button onClick={onCareer}>CAREER JOBS</button></>;
} }));
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
it('opens career jobs and disposes each runtime when returning to racing', async () => {
  await render();
  expect(host.textContent).toBe('CAREER JOBS');
  await click('CAREER JOBS');
  expect(host.querySelector('[aria-label="Career jobs"]')).not.toBeNull();
  expect(host.textContent).not.toContain('RETURN TO CITY');
  expect(lifecycle.raceLeave).toHaveBeenCalledOnce();
  await click('GARAGE');
  expect(lifecycle.careerLeave).toHaveBeenCalledOnce();
  expect(host.textContent).toBe('CAREER JOBS');
});
it.each(['?activity=city', '?activity=explore', '?mode=free', '?mode=career', '?mode=ai&activity=explore&exploreRoom=old-room'])('returns retired city link %s to the garage', async (search) => {
  expect(racingActivity(search)).toBe('race');
  await render(search);
  expect(host.textContent).toBe('CAREER JOBS');
});
it('preserves explicit solo-job links without offering a city launch', async () => {
  expect(racingActivity('?activity=racing-career')).toBe('career');
  await render('?activity=racing-career');
  expect(host.querySelector('[aria-label="Career jobs"]')).not.toBeNull();
  expect(host.textContent).toBe('GARAGE');
  await click('GARAGE');
  expect(host.textContent).toBe('CAREER JOBS');
});
it('keeps paid and resume links in the race runtime even with a career activity', async () => {
  for (const query of ['mode=online', 'tableId=paid-seat', 'code=ABC123']) {
    expect(racingActivity(`?${query}&activity=racing-career`)).toBe('race');
  }
  await render('?mode=online&activity=racing-career&tableId=paid-seat');
  expect(host.textContent).toBe('CAREER JOBS');
});
