import { it, expect, vi } from 'vitest';
import { KartRenderer } from './renderer';
it('career start delegates only to a local closed circuit', () => {
  const r = Object.create(KartRenderer.prototype);
  r.startLocal = vi.fn();
  const loadout = { driver: 'helmet', ammo: 'double', shield: 'single' };
  r.startStreetCareer('skanderbeg', 'rookie', loadout);
  expect(r.startLocal).toHaveBeenCalledWith(
    'skanderbeg',
    'rookie',
    false,
    false,
    loadout
  );
});
it('supplies cannot leak into online, paused, countdown, finished or normal races', () => {
  for (const overrides of [
    { network: true },
    { paused: true },
    { state: 'countdown' },
    { state: 'finished' },
    { streetSupplies: null }
  ]) {
    const r = Object.assign(
      Object.create(KartRenderer.prototype),
      {
        network: false,
        paused: false,
        state: 'racing',
        streetSupplies: { rocket: 2, shield: 1 },
        me: 'you',
        racers: [{ id: 'you', raceItem: null }]
      },
      overrides
    );
    expect(r.equipStreetSupply('rocket')).toBe(false);
    expect(r.racers[0].raceItem).toBeNull();
  }
});
it('equips only the player slot once without overwriting an existing pickup', () => {
  const r = Object.assign(Object.create(KartRenderer.prototype), {
    network: false,
    paused: false,
    state: 'racing',
    streetSupplies: { rocket: 2, shield: 1 },
    me: 'you',
    racers: [
      { id: 'ai', raceItem: null },
      { id: 'you', raceItem: null }
    ]
  });
  expect(r.equipStreetSupply('rocket')).toBe(true);
  expect(r.equipStreetSupply('shield')).toBe(false);
  expect(r.streetSupplies).toEqual({ rocket: 1, shield: 1 });
  expect(r.racers[0].raceItem).toBeNull();
});
