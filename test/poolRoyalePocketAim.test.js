import { resolvePocketMouthAimPoint } from '../webapp/src/pages/Games/poolRoyalePocketAim.js';

describe('Pool Royale pocket-mouth aiming', () => {
  const pocketCenter = { x: -450, y: -220 };
  const targetPos = { x: -260, y: -90 };

  it('keeps the entry near center when the mouth is clean', () => {
    const entry = resolvePocketMouthAimPoint({
      pocketCenter,
      targetPos,
      mouthWidth: 120,
      baseRadius: 48,
      pocketType: 'corner',
      balls: [],
      ignoredBallIds: [],
      ballRadius: 10
    });

    expect(entry).toBeTruthy();
    expect(entry.cleanMouth).toBe(true);
    const inward = {
      x: -pocketCenter.x,
      y: -pocketCenter.y
    };
    const inwardLen = Math.hypot(inward.x, inward.y);
    const inwardUnit = { x: inward.x / inwardLen, y: inward.y / inwardLen };
    const lateralUnit = { x: -inwardUnit.y, y: inwardUnit.x };
    const rel = {
      x: entry.point.x - pocketCenter.x,
      y: entry.point.y - pocketCenter.y
    };
    const lateral = rel.x * lateralUnit.x + rel.y * lateralUnit.y;
    expect(Math.abs(lateral)).toBeLessThan(0.001);
  });

  it('biases toward the far jaw lane when near jaw is crowded', () => {
    const cleanEntry = resolvePocketMouthAimPoint({
      pocketCenter,
      targetPos,
      mouthWidth: 120,
      baseRadius: 48,
      pocketType: 'corner',
      balls: [],
      ignoredBallIds: [],
      ballRadius: 10
    });
    const crowdedNearJaw = {
      id: 99,
      active: true,
      pos: { x: -430, y: -196 }
    };
    const entry = resolvePocketMouthAimPoint({
      pocketCenter,
      targetPos,
      mouthWidth: 120,
      baseRadius: 48,
      pocketType: 'corner',
      balls: [crowdedNearJaw],
      ignoredBallIds: [],
      ballRadius: 10
    });

    expect(entry).toBeTruthy();
    expect(cleanEntry).toBeTruthy();
    expect(entry.cleanMouth).toBe(false);
    expect(entry.nearJawCrowd).toBeGreaterThan(entry.farJawCrowd);
    expect(entry.point.x).not.toBeCloseTo(cleanEntry.point.x, 4);
    expect(entry.point.y).not.toBeCloseTo(cleanEntry.point.y, 4);
  });
});
