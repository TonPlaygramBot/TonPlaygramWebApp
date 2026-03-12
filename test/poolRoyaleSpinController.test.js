import { mapSpinForPhysics, STUN_TOPSPIN_BIAS } from '../webapp/src/pages/Games/poolRoyaleSpinUtils.js';

const getSigns = (vec) => ({
  x: Math.sign(vec.x),
  y: Math.sign(vec.y)
});

describe('Pool Royale spin controller mapping', () => {
  it('maps the center to a slight stun bias with minimal roll', () => {
    const center = mapSpinForPhysics({ x: 0, y: 0 });
    expect(Math.abs(center.x)).toBe(0);
    expect(center.y).toBeLessThanOrEqual(0);
    expect(center.y).toBeGreaterThanOrEqual(STUN_TOPSPIN_BIAS);
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

  it('applies softer spin close to center and stronger spin near cue-tip edge', () => {
    const nearCenter = mapSpinForPhysics({ x: 0.2, y: 0.2 });
    const mid = mapSpinForPhysics({ x: 0.5, y: 0.5 });
    const edge = mapSpinForPhysics({ x: 0.75, y: 0.75 });
    const nearMag = Math.hypot(nearCenter.x, nearCenter.y);
    const midMag = Math.hypot(mid.x, mid.y);
    const edgeMag = Math.hypot(edge.x, edge.y);
    expect(midMag).toBeGreaterThan(nearMag * 1.6);
    expect(edgeMag).toBeGreaterThan(midMag * 1.05);
  });

  it('couples side and vertical spin like a real cue-tip strike', () => {
    const pureSide = mapSpinForPhysics({ x: 0.75, y: 0 });
    const mixed = mapSpinForPhysics({ x: 0.75, y: 0.75 });
    const pureTop = mapSpinForPhysics({ x: 0, y: 0.75 });
    expect(Math.abs(mixed.x)).toBeLessThan(Math.abs(pureSide.x));
    expect(Math.abs(mixed.y)).toBeLessThan(Math.abs(pureTop.y));
  });
});
