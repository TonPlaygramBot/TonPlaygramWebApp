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
    expect(Math.hypot(result.ghost.x - targetPos.x, result.ghost.y - targetPos.y)).toBeCloseTo(0.06, 5);
  });

  it('keeps pre-impact aim unchanged when only side spin changes', () => {
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
    expect(neutral.aimDir.angleTo(withSide.aimDir)).toBeLessThan(1e-6);
    const neutralDepth = Math.hypot(
      neutral.ghost.x - targetPos.x,
      neutral.ghost.y - targetPos.y
    );
    const sideDepth = Math.hypot(
      withSide.ghost.x - targetPos.x,
      withSide.ghost.y - targetPos.y
    );
    expect(sideDepth).toBeCloseTo(neutralDepth, 8);
  });

  it('keeps ghost depth tied to 2R and applies legacy topspin scaling', () => {
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

    const neutralDepth = Math.hypot(
      neutral.ghost.x - targetPos.x,
      neutral.ghost.y - targetPos.y
    );
    const topspinDepth = Math.hypot(
      topspin.ghost.x - targetPos.x,
      topspin.ghost.y - targetPos.y
    );
    expect(neutralDepth).toBeCloseTo(0.06, 5);
    expect(topspinDepth).toBeGreaterThan(neutralDepth);
    expect(topspinDepth).toBeCloseTo(0.0642, 4);
  });
});
