import { mapSpinForPhysics } from '../webapp/src/pages/Games/poolRoyaleSpinUtils.js';

const getSigns = (vec) => ({
  x: Math.sign(vec.x),
  y: Math.sign(vec.y)
});

describe('Pool Royale spin controller mapping', () => {
  it('maps the center to a slight default topspin bias', () => {
    const center = mapSpinForPhysics({ x: 0, y: 0 });
    expect(Math.abs(center.x)).toBe(0);
    expect(center.y).toBeGreaterThan(0);
    expect(center.y).toBeLessThan(0.25);
  });

  it('keeps left/right spin directions aligned with the table axes', () => {
    expect(getSigns(mapSpinForPhysics({ x: -1, y: 0 })).x).toBe(-1);
    expect(getSigns(mapSpinForPhysics({ x: 1, y: 0 })).x).toBe(1);
  });

  it('keeps vertical spin aligned so topspin drives forward motion', () => {
    expect(getSigns(mapSpinForPhysics({ x: 0, y: 1 })).y).toBe(1);
    expect(getSigns(mapSpinForPhysics({ x: 0, y: -1 })).y).toBe(-1);
  });

  it('preserves diagonal quadrants while keeping vertical spin aligned', () => {
    expect(getSigns(mapSpinForPhysics({ x: -1, y: -1 }))).toEqual({ x: -1, y: -1 });
    expect(getSigns(mapSpinForPhysics({ x: 1, y: -1 }))).toEqual({ x: 1, y: -1 });
    expect(getSigns(mapSpinForPhysics({ x: -1, y: 1 }))).toEqual({ x: -1, y: 1 });
    expect(getSigns(mapSpinForPhysics({ x: 1, y: 1 }))).toEqual({ x: 1, y: 1 });
  });

  it('scales spin strength with distance from center', () => {
    const inner = Math.abs(mapSpinForPhysics({ x: 0, y: 0.4 }).y);
    const outer = Math.abs(mapSpinForPhysics({ x: 0, y: 0.9 }).y);
    expect(inner).toBeGreaterThan(0);
    expect(outer).toBeGreaterThan(inner);
  });

  it('applies progressive spin response so outer hits gain more effective spin', () => {
    const nearCenter = mapSpinForPhysics({ x: 0, y: 0.35 });
    const mid = mapSpinForPhysics({ x: 0, y: 0.6 });
    const outer = mapSpinForPhysics({ x: 0, y: 1 });
    const nearMag = Math.abs(nearCenter.y);
    const midMag = Math.abs(mid.y);
    const outerMag = Math.abs(outer.y);
    expect(midMag - nearMag).toBeGreaterThan(0.1);
    expect(outerMag - midMag).toBeGreaterThan(0.12);
  });

  it('reduces side-spin efficiency when strong top/back spin is also requested', () => {
    const pureSide = Math.abs(mapSpinForPhysics({ x: 1, y: 0 }).x);
    const mixedSide = Math.abs(mapSpinForPhysics({ x: 1, y: 1 }).x);
    expect(mixedSide).toBeLessThan(pureSide);
  });

});
