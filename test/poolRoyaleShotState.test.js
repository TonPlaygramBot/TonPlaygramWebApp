import { SHOT_STATE, resolveCommittedShot, easeOut } from '../webapp/src/pages/Games/poolRoyaleShotState.js';

describe('Pool Royale shot state commit flow', () => {
  it('stays idle for low/zero captured power', () => {
    const committed = resolveCommittedShot({ capturedDragPower: 0.01, minStrikePower: 0.02 });
    expect(committed.shotPower).toBeCloseTo(0.01, 6);
    expect(committed.state).toBe(SHOT_STATE.IDLE);
  });

  it('enters striking with captured drag power and ignores non-finite slider noise', () => {
    const committed = resolveCommittedShot({ capturedDragPower: Number.NaN, fallbackPower: 0.68 });
    expect(committed.shotPower).toBeCloseTo(0.68, 6);
    expect(committed.state).toBe(SHOT_STATE.STRIKING);
  });

  it('clamps captured power to valid range before strike', () => {
    const low = resolveCommittedShot({ capturedDragPower: -2, fallbackPower: 0.4 });
    const high = resolveCommittedShot({ capturedDragPower: 2 });
    expect(low.shotPower).toBe(0);
    expect(low.state).toBe(SHOT_STATE.IDLE);
    expect(high.shotPower).toBe(1);
    expect(high.state).toBe(SHOT_STATE.STRIKING);
  });

  it('uses cubic ease-out for slider reset curve', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.6)).toBeCloseTo(0.936, 3);
  });
});
