import {
  ShotState,
  easeOut,
  computePullDistance,
  shouldTriggerImpact
} from '../webapp/src/pages/Games/poolRoyaleShotInteraction.js';

describe('pool royale shot interaction helpers', () => {
  test('exposes the reference shot states', () => {
    expect(ShotState).toEqual({
      IDLE: 'idle',
      DRAGGING: 'dragging',
      STRIKING: 'striking'
    });
  });

  test('uses eased pull distance from captured power', () => {
    const low = computePullDistance({
      power: 0.2,
      pullRange: 0.34,
      maxPull: 1
    });
    const high = computePullDistance({
      power: 0.9,
      pullRange: 0.34,
      maxPull: 1
    });
    expect(low).toBeCloseTo(0.34 * easeOut(0.2), 6);
    expect(high).toBeCloseTo(0.34 * easeOut(0.9), 6);
    expect(high).toBeGreaterThan(low);
  });

  test('triggers impact once cue reaches contact gap', () => {
    const impact = { x: 0, y: 0, z: 0 };
    const nearCue = { x: 0.01, y: 0, z: 0 };
    const farCue = { x: 0.5, y: 0, z: 0 };
    expect(
      shouldTriggerImpact({
        cuePosition: farCue,
        impactPosition: impact,
        elapsed: 20,
        strikeDuration: 120,
        contactGap: 0.02
      })
    ).toBe(false);
    expect(
      shouldTriggerImpact({
        cuePosition: nearCue,
        impactPosition: impact,
        elapsed: 20,
        strikeDuration: 120,
        contactGap: 0.02
      })
    ).toBe(true);
  });
});
