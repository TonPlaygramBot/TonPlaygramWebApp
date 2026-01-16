import { mapSpinForPhysics } from '../webapp/src/pages/Games/poolRoyaleSpinUtils.js';

const getSigns = (vec) => ({
  x: Math.sign(vec.x),
  y: Math.sign(vec.y)
});

describe('Pool Royale spin controller mapping', () => {
  it('maps the center to no spin', () => {
    const center = mapSpinForPhysics({ x: 0, y: 0 });
    expect(Math.abs(center.x)).toBe(0);
    expect(Math.abs(center.y)).toBe(0);
  });

  it('keeps left/right spin directions aligned with the table axes', () => {
    expect(getSigns(mapSpinForPhysics({ x: -1, y: 0 })).x).toBe(1);
    expect(getSigns(mapSpinForPhysics({ x: 1, y: 0 })).x).toBe(-1);
  });

  it('keeps vertical spin aligned so topspin drives forward motion', () => {
    expect(getSigns(mapSpinForPhysics({ x: 0, y: 1 })).y).toBe(1);
    expect(getSigns(mapSpinForPhysics({ x: 0, y: -1 })).y).toBe(-1);
  });

  it('preserves diagonal quadrants while keeping vertical spin aligned', () => {
    expect(getSigns(mapSpinForPhysics({ x: -1, y: -1 }))).toEqual({ x: 1, y: -1 });
    expect(getSigns(mapSpinForPhysics({ x: 1, y: -1 }))).toEqual({ x: -1, y: -1 });
    expect(getSigns(mapSpinForPhysics({ x: -1, y: 1 }))).toEqual({ x: 1, y: 1 });
    expect(getSigns(mapSpinForPhysics({ x: 1, y: 1 }))).toEqual({ x: -1, y: 1 });
  });

  it('scales spin strength with distance from center', () => {
    const inner = Math.abs(mapSpinForPhysics({ x: 0, y: 0.4 }).y);
    const outer = Math.abs(mapSpinForPhysics({ x: 0, y: 0.9 }).y);
    expect(inner).toBeGreaterThan(0);
    expect(outer).toBeGreaterThan(inner);
  });
});
