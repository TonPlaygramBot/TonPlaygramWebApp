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
    expect(Math.hypot(result.ghost.x - targetPos.x, result.ghost.y - targetPos.y)).toBeGreaterThan(0.04);
  });

  it('applies side-spin compensation as a measurable aim shift', () => {
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
    expect(neutral.aimDir.angleTo(withSide.aimDir)).toBeGreaterThan(0.001);
  });

  it('keeps suggestion influence while still applying final pot correction', () => {
    const withoutSuggestion = resolveAiPotGhostAim({
      cuePos,
      targetPos,
      pocketPos,
      ballRadius: 0.03,
      spin: { x: 0.3, y: -0.2 },
      power: 0.75
    });
    const withSuggestion = resolveAiPotGhostAim({
      cuePos,
      targetPos,
      pocketPos,
      ballRadius: 0.03,
      spin: { x: 0.3, y: -0.2 },
      power: 0.75,
      suggestedAimDir: { x: 0.95, y: 0.32 },
      suggestedWeight: 0.3
    });
    expect(withoutSuggestion).toBeTruthy();
    expect(withSuggestion).toBeTruthy();
    expect(withSuggestion.aimDir.length()).toBeCloseTo(1, 5);
    expect(withoutSuggestion.aimDir.angleTo(withSuggestion.aimDir)).toBeGreaterThan(0.0005);
  });
});
