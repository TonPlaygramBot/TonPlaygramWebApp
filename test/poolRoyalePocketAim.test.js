import { resolvePocketMouthAimPoint } from '../webapp/src/pages/Games/poolRoyalePocketAim.js';

describe('Pool Royale pocket-mouth aim targeting', () => {
  it('returns an entry point pulled inward from the pocket center', () => {
    const result = resolvePocketMouthAimPoint({
      pocketCenter: { x: -1, y: -1 },
      targetPos: { x: -0.4, y: -0.7 },
      mouthWidth: 0.2,
      baseRadius: 0.1,
      pocketType: 'corner'
    });

    expect(result).toBeTruthy();
    const inwardDot =
      (result.point.x + 1) * 1 +
      (result.point.y + 1) * 1;
    expect(inwardDot).toBeGreaterThan(0);
  });

  it('keeps lateral shift within a safe center-lane corridor', () => {
    const mouthWidth = 0.22;
    const halfMouth = mouthWidth * 0.5;
    const result = resolvePocketMouthAimPoint({
      pocketCenter: { x: 1, y: -1 },
      targetPos: { x: 0.9, y: -0.15 },
      mouthWidth,
      baseRadius: 0.11,
      pocketType: 'corner'
    });

    expect(result).toBeTruthy();
    expect(Math.abs(result.lateralBias)).toBeLessThanOrEqual(1);

    const inward = { x: -1 / Math.sqrt(2), y: 1 / Math.sqrt(2) };
    const lateral = { x: -inward.y, y: inward.x };
    const dx = result.point.x - 1;
    const dy = result.point.y + 1;
    const lateralOffset = dx * lateral.x + dy * lateral.y;
    expect(Math.abs(lateralOffset)).toBeLessThan(halfMouth * 0.4);
  });

  it('works for side pockets and keeps aim between jaws', () => {
    const result = resolvePocketMouthAimPoint({
      pocketCenter: { x: -1.1, y: 0 },
      targetPos: { x: -0.6, y: 0.42 },
      mouthWidth: 0.24,
      baseRadius: 0.12,
      pocketType: 'side'
    });

    expect(result).toBeTruthy();
    // Side pocket inward is +X in this setup, so entry should move right.
    expect(result.point.x).toBeGreaterThan(-1.1);
    // Should still stay near the middle lane, not near a jaw edge.
    expect(Math.abs(result.point.y)).toBeLessThan(0.05);
  });
});
