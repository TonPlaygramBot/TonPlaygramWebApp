import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const harness = vi.hoisted(() => ({ game: null, finish: null, frame: null }));
vi.mock('./renderer', () => ({
  KartRenderer: class {
    constructor(_, frame, finish) {
      harness.game = this;
      harness.finish = finish;
      harness.frame = frame;
      this.input = {};
    }
    load = vi.fn(async () => {});
    setKart = vi.fn();
    setColor = vi.fn();
    setCameraMode = vi.fn();
    startStreetCareer = vi.fn();
    equipStreetSupply = vi.fn();
    clearInput = vi.fn(() => (this.input = {}));
    pause = vi.fn();
    showGarage = vi.fn();
    destroy = vi.fn();
  }
}));
vi.mock('./audio', () => ({
  KartAudio: class {
    unlock() {}
    update() {}
    silence() {}
    destroy() {}
    setMuted() {}
  }
}));
import { StreetCareerGame } from './StreetCareerGame';
import { TRACKS } from './simulation.mjs';
import { STREET_CAREER_KEY } from './streetCareer.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
beforeEach(async () => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<StreetCareerGame onExit={() => {}} />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const button = (text) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent === text);
it('offers every current track, local-only loadout and no free roam', () => {
  expect(host.querySelectorAll('.sc-stages article')).toHaveLength(
    TRACKS.length
  );
  expect(host.textContent).toContain('cannot be withdrawn');
  expect(host.textContent).not.toContain('FREE ROAM');
  expect(
    [...host.querySelectorAll('.sc-stages button')].filter((b) => !b.disabled)
  ).toHaveLength(1);
});
it('persists driver selection and passes it to local career start', async () => {
  const select = host.querySelector('select');
  await act(async () => {
    select.value = 'helmet';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(
    JSON.parse(localStorage.getItem(STREET_CAREER_KEY)).loadout.driver
  ).toBe('helmet');
  await act(async () => button('RACE').click());
  expect(harness.game.startStreetCareer).toHaveBeenCalledWith(
    TRACKS[0].id,
    'rookie',
    expect.objectContaining({ driver: 'helmet' })
  );
});
it('pauses on blur and clears held input; leaving race grants no reward', async () => {
  await act(async () => button('RACE').click());
  await act(async () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }))
  );
  expect(harness.game.input.throttle).toBe(true);
  await act(async () => window.dispatchEvent(new Event('blur')));
  expect(harness.game.pause).toHaveBeenLastCalledWith(true);
  expect(harness.game.input.throttle).not.toBe(true);
  await act(async () => button('RETURN TO CAREER').click());
  expect(localStorage.getItem(STREET_CAREER_KEY)).toBeNull();
  expect(harness.game.showGarage).toHaveBeenCalled();
});
it('accepts matching finish once and unlocks next stage', async () => {
  await act(async () => button('RACE').click());
  const result = {
    trackId: TRACKS[0].id,
    playerId: 'you',
    racers: [{ id: 'you', finished: true, finishTime: 90, health: 100 }]
  };
  await act(async () => {
    harness.finish(result);
    harness.finish(result);
  });
  expect(JSON.parse(localStorage.getItem(STREET_CAREER_KEY)).xp).toBe(200);
  expect(
    [...host.querySelectorAll('.sc-stages button')].filter((b) => !b.disabled)
  ).toHaveLength(2);
});

const label = (name) => host.querySelector(`button[aria-label="${name}"]`);
const press = async (element) => act(async () => element.click());

it('keeps the career board and settings off the driving view, but shows live progress and controls', async () => {
  expect(host.querySelector('.sc-board')).not.toBeNull();
  await press(button('RACE'));
  expect(host.querySelector('header')).toBeNull();
  expect(host.querySelector('.sc-board')).toBeNull();
  expect(button('CHASE CAMERA')).toBeUndefined();
  expect(button('MUTE')).toBeUndefined();
  expect(host.querySelector('.sc-supplies').hidden).toBe(true);
  expect(host.querySelector('.kart-steering-stick')).not.toBeNull();
  expect(button('GAS').disabled).toBe(false);
  await act(async () => harness.frame({ countdown: 2 }));
  expect(host.querySelector('.sc-hud').textContent).toContain('START 2');
  await act(async () => harness.frame({ lap: 2, position: 3, time: 69.25, health: 67 }));
  expect(host.querySelector('.sc-race-progress strong').textContent).toBe('LAP 2/3 · P3');
  expect(host.querySelector('.sc-race-progress span').textContent).toBe('1:09.25 · 67%');
});

it('opens supplies on demand, preserves item and countdown restrictions, and closes after loading', async () => {
  await press(button('RACE'));
  const supplyPanel = host.querySelector('.sc-supplies');
  const supplies = label('Race supplies');
  await act(async () => harness.frame({ countdown: 2, careerSupplies: { rocket: 2, shield: 0 } }));
  await press(supplies);
  expect(supplies.getAttribute('aria-expanded')).toBe('true');
  expect(supplyPanel.hidden).toBe(false);
  expect(button('LOAD ROCKET · 2').disabled).toBe(true);
  await act(async () => harness.frame({ raceItem: 'boost', careerSupplies: { rocket: 2, shield: 0 } }));
  expect(button('LOAD ROCKET · 2').disabled).toBe(true);
  await act(async () => harness.frame({ careerSupplies: { rocket: 2, shield: 0 } }));
  expect(button('LOAD SHIELD · 0').disabled).toBe(true);
  await press(button('LOAD ROCKET · 2'));
  expect(harness.game.equipStreetSupply).toHaveBeenCalledWith('rocket');
  expect(supplyPanel.hidden).toBe(true);
  expect(supplies.getAttribute('aria-expanded')).toBe('false');
});

it('puts camera, sound, and exit behind pause and resumes with no open supplies', async () => {
  await press(button('RACE'));
  await press(label('Race supplies'));
  await press(label('Pause race'));
  expect(host.querySelector('.sc-supplies').hidden).toBe(true);
  expect(button('GAS').disabled).toBe(true);
  expect(button('EXIT TO GARAGE')).toBeDefined();
  await press(button('CHASE CAMERA'));
  expect(harness.game.setCameraMode).toHaveBeenLastCalledWith('chase');
  await press(button('MUTE'));
  expect(button('UNMUTE')).toBeDefined();
  await press(button('CONTINUE'));
  expect(harness.game.pause).toHaveBeenLastCalledWith(false);
  expect(button('GAS').disabled).toBe(false);
  expect(host.querySelector('.sc-pause')).toBeNull();
  expect(host.querySelector('.sc-supplies').hidden).toBe(true);
});

it('keeps keyboard driving and Escape pause available after using the HUD', async () => {
  await press(button('RACE'));
  const supplies = label('Race supplies');
  supplies.focus();
  await act(async () => supplies.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true })));
  expect(harness.game.input.throttle).toBe(true);
  await act(async () => supplies.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(harness.game.pause).toHaveBeenLastCalledWith(true);
  expect(harness.game.input.throttle).not.toBe(true);
});
