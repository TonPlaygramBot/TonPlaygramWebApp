import { resolveAiPotGhostAim } from '../webapp/src/pages/Games/poolRoyaleAiAimCompensation.js';

describe('Pool Royale AI aim compensation', () => {
  const cuePos = { x: -0.35, y: -0.4 };
  const targetPos = { x: 0.1, y: 0.05 };
  const pocketPos = { x: 0.45, y: 0.45 };

  it('returns a normalized center-pocket ghost aim without spin', () => {
    const result = resolveAiPotGhostAim({
      cuePos,
      targetPos,
      pocketPos,
      ballRadius: 0.03,
      spin: { x: 0, y: 0 },
      power: 0.7
    });
    expect(result).toBeTruthy();
    expect(result.aimDir.length()).toBeCloseTo(1, 5);
    expect(Math.hypot(result.ghost.x - targetPos.x, result.ghost.y - targetPos.y)).toBeCloseTo(0.06024, 4);
  });

  it('applies a small pre-impact offset when side spin + power increase', () => {
    const neutral = resolveAiPotGhostAim({
      cuePos,
      targetPos,
      pocketPos,
      ballRadius: 0.03,
      spin: { x: 0, y: 0 },
      power: 0.8
    });
    const withSide = resolveAiPotGhostAim({
      cuePos,
      targetPos,
      pocketPos,
      ballRadius: 0.03,
      spin: { x: 0.45, y: 0 },
      power: 0.8
    });
    expect(withSide).toBeTruthy();
    expect(neutral.aimDir.angleTo(withSide.aimDir)).toBeGreaterThan(1e-4);
    expect(withSide.contactDepth).toBeCloseTo(neutral.contactDepth, 8);
  });

  
  it('increases side-spin compensation with higher shot power', () => {
    const lowPower = resolveAiPotGhostAim({
      cuePos,
      targetPos,
      pocketPos,
      ballRadius: 0.03,
      spin: { x: 0.6, y: 0 },
      power: 0.25
    });
    const highPower = resolveAiPotGhostAim({
      cuePos,
      targetPos,
      pocketPos,
      ballRadius: 0.03,
      spin: { x: 0.6, y: 0 },
      power: 1
    });

    expect(lowPower).toBeTruthy();
    expect(highPower).toBeTruthy();
    expect(highPower.aimDir.angleTo(lowPower.aimDir)).toBeGreaterThan(1e-4);
  });
it('keeps contact depth close to 2R and adjusts only slightly with spin', () => {
    const neutral = resolveAiPotGhostAim({
      cuePos,
      targetPos,
      pocketPos,
      ballRadius: 0.03,
      spin: { x: 0, y: 0 },
      power: 1
    });

    const topspin = resolveAiPotGhostAim({
      cuePos,
      targetPos,
      pocketPos,
      ballRadius: 0.03,
      spin: { x: 0, y: 1 },
      power: 1
    });

    expect(neutral.contactDepth).toBeCloseTo(0.06024, 5);
    expect(topspin.contactDepth).toBeGreaterThan(neutral.contactDepth);
    expect(topspin.contactDepth - neutral.contactDepth).toBeLessThan(0.0015);
  });
});
