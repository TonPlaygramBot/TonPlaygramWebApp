import { resolveAiPotGhostAim } from '../webapp/src/pages/Games/poolRoyaleAiAimCompensation.js';

describe('Pool Royale AI aim compensation', () => {
  const cuePos = { x: -0.35, y: -0.4 };
  const targetPos = { x: 0.1, y: 0.05 };
  const pocketPos = { x: 0.45, y: 0.45 };

  it('returns a normalized center-pocket ghost aim without spin', () => {
    const ballRadius = 0.03;
    const result = resolveAiPotGhostAim({
      cuePos,
      targetPos,
      pocketPos,
      ballRadius,
      spin: { x: 0, y: 0 },
      power: 0.7
    });
    expect(result).toBeTruthy();
    expect(result.aimDir.length()).toBeCloseTo(1, 5);
    expect(Math.hypot(result.ghost.x - targetPos.x, result.ghost.y - targetPos.y)).toBeCloseTo(ballRadius * 2, 3);
  });

  it('keeps the exact pre-impact pocket line when side spin and power are present', () => {
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
    expect(neutral.aimDir.angleTo(withSide.aimDir)).toBeLessThan(1e-8);
    expect(withSide.contactDepth).toBeCloseTo(neutral.contactDepth, 8);
  });

  it('keeps contact depth exactly at 2R regardless of spin', () => {
    const ballRadius = 0.03;
    const neutral = resolveAiPotGhostAim({
      cuePos,
      targetPos,
      pocketPos,
      ballRadius,
      spin: { x: 0, y: 0 },
      power: 1
    });

    const topspin = resolveAiPotGhostAim({
      cuePos,
      targetPos,
      pocketPos,
      ballRadius,
      spin: { x: 0, y: 1 },
      power: 1
    });

    expect(neutral.contactDepth).toBeCloseTo(ballRadius * 2, 3);
    expect(topspin.contactDepth).toBeCloseTo(neutral.contactDepth, 8);
  });

  it('keeps the object-ball contact normal precisely on the pocket line for thin cuts', () => {
    const result = resolveAiPotGhostAim({
      cuePos: { x: -0.5, y: -0.05 },
      targetPos: { x: 0.08, y: 0.02 },
      pocketPos: { x: 0.14, y: 0.6 },
      ballRadius: 0.03,
      spin: { x: 0, y: 0 },
      power: 0.72
    });
    const contactNormal = result.ghost.clone().sub({ x: 0.08, y: 0.02 }).normalize();
    const pocketLine = { x: 0.08 - 0.14, y: 0.02 - 0.6 };
    const pocketLength = Math.hypot(pocketLine.x, pocketLine.y);
    const alignment =
      contactNormal.x * (pocketLine.x / pocketLength) +
      contactNormal.y * (pocketLine.y / pocketLength);

    expect(alignment).toBeCloseTo(1, 7);
    expect(result.contactDepth).toBeCloseTo(0.06, 6);
  });

  it('keeps geometrically identical aim across table and ball scales', () => {
    const small = resolveAiPotGhostAim({
      cuePos,
      targetPos,
      pocketPos,
      ballRadius: 0.03,
      spin: { x: 0.5, y: -0.25 },
      power: 0.85
    });
    const scale = 10;
    const large = resolveAiPotGhostAim({
      cuePos: { x: cuePos.x * scale, y: cuePos.y * scale },
      targetPos: { x: targetPos.x * scale, y: targetPos.y * scale },
      pocketPos: { x: pocketPos.x * scale, y: pocketPos.y * scale },
      ballRadius: 0.03 * scale,
      spin: { x: 0.5, y: -0.25 },
      power: 0.85
    });

    expect(small.aimDir.angleTo(large.aimDir)).toBeLessThan(1e-7);
  });
});
