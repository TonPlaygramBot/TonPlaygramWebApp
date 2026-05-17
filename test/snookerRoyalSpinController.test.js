import {
  SPIN_DIRECTIONS,
  mapSpinForPhysics,
  normalizeSpinInput
} from '../webapp/src/pages/Games/snookerRoyalSpinUtils.js';

describe('Snooker Royal/Champion natural spin controller', () => {
  it('limits available presets to center and natural forward spin', () => {
    expect(SPIN_DIRECTIONS.map((direction) => direction.id)).toEqual([
      'stun',
      'natural-follow'
    ]);
  });

  it('suppresses side english and draw/backspin from user input', () => {
    expect(normalizeSpinInput({ x: 1, y: 0 }).x).toBe(0);
    expect(normalizeSpinInput({ x: -1, y: 0 }).x).toBe(0);
    expect(normalizeSpinInput({ x: 0, y: -1 })).toEqual({ x: 0, y: 0 });
  });

  it('maps diagonal or backward UI drags to ahead-only natural spin', () => {
    const diagonal = mapSpinForPhysics({ x: 1, y: 1 });
    expect(diagonal.x).toBe(0);
    expect(diagonal.y).toBeGreaterThan(0);

    const backward = mapSpinForPhysics({ x: 1, y: -1 });
    expect(backward).toEqual({ x: 0, y: 0 });
  });
});
