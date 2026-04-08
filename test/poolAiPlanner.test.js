import { planShot } from '../webapp/public/lib/poolAi.js';

describe('Pool Royale AI planner', () => {
  const baseState = {
    width: 1000,
    height: 500,
    ballRadius: 10,
    friction: 0.03,
    pockets: [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 1000, y: 0 },
      { x: 0, y: 500 },
      { x: 500, y: 500 },
      { x: 1000, y: 500 }
    ]
  };

  it('respects legal targets to avoid first-contact fouls', () => {
    const plan = planShot({
      game: 'AMERICAN_BILLIARDS',
      state: {
        ...baseState,
        legalBallIds: [2],
        balls: [
          { id: 0, x: 150, y: 250, pocketed: false, vx: 0, vy: 0 },
          { id: 2, x: 650, y: 240, pocketed: false, vx: 0, vy: 0 },
          { id: 11, x: 320, y: 245, pocketed: false, vx: 0, vy: 0 }
        ]
      },
      rngSeed: 7
    });

    expect(plan.targetBallId).toBe(2);
  });

  it('uses a cushion escape shot when no pocket route exists', () => {
    const plan = planShot({
      game: 'AMERICAN_BILLIARDS',
      state: {
        ...baseState,
        pockets: [],
        legalBallIds: [2],
        balls: [
          { id: 0, x: 180, y: 240, pocketed: false, vx: 0, vy: 0 },
          { id: 2, x: 780, y: 220, pocketed: false, vx: 0, vy: 0 }
        ]
      },
      rngSeed: 12
    });

    expect(plan.rationale).toContain('cushion-escape');
    expect(plan.targetBallId).toBe(2);
    expect(plan.power).toBeGreaterThan(0.35);
  });
});
