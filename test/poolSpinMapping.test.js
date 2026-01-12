import { mapSpinForPhysics } from '../webapp/src/utils/spinMapping.js';

const expectVector = (vec) => ({
  x: vec.x ?? 0,
  y: vec.y ?? 0
});

describe('pool spin mapping', () => {
  test('keeps center as no spin', () => {
    const center = mapSpinForPhysics({ x: 0, y: 0 });
    expect(Math.abs(center.x)).toBeCloseTo(0, 8);
    expect(Math.abs(center.y)).toBeCloseTo(0, 8);
  });

  test('maps top/bottom/left/right to expected directions', () => {
    const top = mapSpinForPhysics({ x: 0, y: -1 });
    const bottom = mapSpinForPhysics({ x: 0, y: 1 });
    const left = mapSpinForPhysics({ x: -1, y: 0 });
    const right = mapSpinForPhysics({ x: 1, y: 0 });

    expect(top.y).toBeGreaterThan(0);
    expect(bottom.y).toBeLessThan(0);
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
  });

  test('preserves corner directions', () => {
    const topLeft = mapSpinForPhysics({ x: -1, y: -1 });
    const topRight = mapSpinForPhysics({ x: 1, y: -1 });
    const bottomLeft = mapSpinForPhysics({ x: -1, y: 1 });
    const bottomRight = mapSpinForPhysics({ x: 1, y: 1 });

    expect(topLeft.x).toBeLessThan(0);
    expect(topLeft.y).toBeGreaterThan(0);
    expect(topRight.x).toBeGreaterThan(0);
    expect(topRight.y).toBeGreaterThan(0);
    expect(bottomLeft.x).toBeLessThan(0);
    expect(bottomLeft.y).toBeLessThan(0);
    expect(bottomRight.x).toBeGreaterThan(0);
    expect(bottomRight.y).toBeLessThan(0);
  });

  test('spin magnitude grows with distance from center', () => {
    const near = mapSpinForPhysics({ x: 0, y: -0.2 });
    const far = mapSpinForPhysics({ x: 0, y: -0.8 });
    expect(Math.abs(near.y)).toBeLessThan(Math.abs(far.y));
  });

  test('small inputs fall back to no spin', () => {
    const tiny = mapSpinForPhysics({ x: 0.01, y: 0.01 });
    expect(Math.abs(tiny.x)).toBeCloseTo(0, 8);
    expect(Math.abs(tiny.y)).toBeCloseTo(0, 8);
  });
});
