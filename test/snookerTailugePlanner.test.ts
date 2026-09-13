import {
  createSnookerPlanner,
  legalSnookerTargets,
  planSnookerShot,
  type AiBall,
  type PlannerInput
} from '../webapp/src/games/snooker/ai/shotPlanner';
import {
  ghostBallPosition,
  rayBallDistance
} from '../webapp/src/games/snooker/ai/tailugeAim';
import { SnookerRoyalRules } from '../src/rules/SnookerRoyalRules';

const ball = (id: string, color: string, x: number, y: number): AiBall => ({
  id,
  color,
  pos: { x, y },
  active: true
});
function layout(extra: AiBall[] = []): PlannerInput {
  return {
    balls: [ball('cue', 'CUE', 0, 6), ball('red1', 'RED', 0, 0), ...extra],
    cueId: 'cue',
    frame: { ballOn: ['RED'], activePlayer: 'B' },
    radius: 0.5,
    halfWidth: 5,
    halfHeight: 10,
    pockets: [{ id: 'TOP', pos: { x: 0, y: -10 }, mouth: 1.6 }],
    powerForDistance: (d) => 0.2 + d / 60
  };
}

test('Tailuge ghost ball lies on the approach side and scales with the actual ball radius', () => {
  expect(ghostBallPosition({ x: 0, y: 0 }, { x: 0, y: -10 }, 0.5)).toEqual({
    x: 0,
    y: 1.0005
  });
  expect(ghostBallPosition({ x: 0, y: 0 }, { x: 0, y: 0 }, 0.5)).toBeNull();
});
test('a straight pot selects the actual target and mouth without mutating the layout', () => {
  const input = layout();
  const before = JSON.stringify(input);
  const plan = planSnookerShot(input).bestPot!;
  expect(plan.targetId).toBe('red1');
  expect(plan.pocketId).toBe('TOP');
  expect(plan.aimDir).toEqual({ x: 0, y: -1 });
  expect(plan.verifiedContact).toBe(true);
  expect(plan.power).toBeGreaterThan(0);
  expect(JSON.stringify(input)).toBe(before);
});
test('the first-contact test uses both ball radii', () => {
  expect(
    rayBallDistance({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0.9, y: 3 }, 1)
  ).not.toBeNull();
  const result = planSnookerShot(layout([ball('blue', 'BLUE', 0.9, 3)]));
  expect(result.bestPot).toBeNull();
});
test('a blocked object-ball route is never advertised as a pot', () => {
  const result = planSnookerShot(layout([ball('pink', 'PINK', 0, -5)]));
  expect(result.bestPot).toBeNull();
  expect(result.bestSafety?.target).toBe('RED');
});
test('a pocket behind the cue cannot produce a backwards cut pot', () => {
  const input = layout();
  input.pockets = [{ id: 'BOTTOM', pos: { x: 0, y: 10 }, mouth: 1.6 }];
  expect(planSnookerShot(input).bestPot).toBeNull();
});
test('checks another pocket when the easiest angle is blocked', () => {
  const input = layout([ball('pink', 'PINK', 0, -5)]);
  input.pockets = [
    ...input.pockets,
    { id: 'CORNER', pos: { x: 5, y: -10 }, mouth: 1.6 }
  ];
  expect(planSnookerShot(input).bestPot?.pocketId).toBe('CORNER');
});
test('nominated blue never targets yellow, and ordered yellow never targets blue', () => {
  const input = layout([
    ball('blue', 'BLUE', 2, 0),
    ball('yellow', 'YELLOW', -2, 0)
  ]);
  expect(
    legalSnookerTargets({ ballOn: ['BLUE'] }, input.balls, 'cue').map(
      (b) => b.id
    )
  ).toEqual(['blue']);
  expect(
    legalSnookerTargets({ ballOn: ['YELLOW'] }, input.balls, 'cue').map(
      (b) => b.id
    )
  ).toEqual(['yellow']);
});
test('inactive and invalid balls are excluded', () => {
  const input = layout();
  input.balls[1].active = false;
  input.balls = [...input.balls, ball('red2', 'RED', NaN, 0)];
  expect(planSnookerShot(input)).toEqual({ bestPot: null, bestSafety: null });
});
test.each([{ ballOn: [] }, { ballOn: ['GREEN'] }])(
  'missing legal balls do not silently fall back to another colour (%j)',
  ({ ballOn }) => {
    const input = layout();
    input.frame = { ballOn };
    expect(planSnookerShot(input)).toEqual({ bestPot: null, bestSafety: null });
  }
);
test('completed frames and absent cue balls produce no shot', () => {
  const input = layout();
  input.frame.frameOver = true;
  expect(planSnookerShot(input).bestSafety).toBeNull();
  input.frame.frameOver = false;
  input.balls[0].active = false;
  expect(planSnookerShot(input).bestPot).toBeNull();
});
test('snookered cue searches cushions and only accepts a legal first contact', () => {
  const input = layout([ball('blue', 'BLUE', 0, 3)]);
  const result = planSnookerShot(input);
  expect(result.bestPot).toBeNull();
  expect(result.bestSafety?.viaCushion).toBe(true);
  expect(result.bestSafety?.verifiedContact).toBe(true);
  expect(result.bestSafety?.targetId).toBe('red1');
  expect(result.bestSafety!.route.length).toBeGreaterThan(2);
});
test('blocked escape is explicitly unverified and still targets a ball-on', () => {
  const input = layout();
  input.balls = [
    ...input.balls,
    ...Array.from({ length: 12 }, (_, i) =>
      ball(
        `block${i}`,
        'BLUE',
        Math.cos((i * Math.PI) / 6) * 1.1,
        6 + Math.sin((i * Math.PI) / 6) * 1.1
      )
    )
  ];
  expect(planSnookerShot(input).bestSafety?.verifiedContact).toBe(false);
  expect(planSnookerShot(input).bestSafety?.target).toBe('RED');
});
test('power callback failures cannot result in NaN or out-of-range shots', () => {
  const input = layout();
  input.powerForDistance = () => NaN;
  expect(planSnookerShot(input).bestPot?.power).toBe(0.5);
  input.powerForDistance = () => 100;
  expect(planSnookerShot(input).bestPot?.power).toBe(0.95);
});
test('uses the supplied model pocket entrance rather than substituting upstream table coordinates', () => {
  const input = layout();
  input.pocketForTarget = () => ({ x: 1, y: -9 });
  expect(planSnookerShot(input).bestPot?.pocketCenter).toEqual({ x: 1, y: -9 });
});
test('cache reuses a stopped layout and invalidates for movement, phase and table size', () => {
  const plan = createSnookerPlanner();
  const input = layout();
  const first = plan(input);
  expect(plan(input)).toBe(first);
  input.balls[1].pos.x = 0.1;
  const moved = plan(input);
  expect(moved).not.toBe(first);
  input.radius = 0.6;
  expect(plan(input)).not.toBe(moved);
  input.frame = { ballOn: ['BLUE'] };
  expect(plan(input).bestPot).toBeNull();
});
test('scales the same shot consistently for a different table size', () => {
  const input = layout();
  const first = planSnookerShot(input).bestPot!;
  const scaled = {
    ...input,
    radius: 1,
    halfWidth: 10,
    halfHeight: 20,
    balls: input.balls.map((b) => ({
      ...b,
      pos: { x: b.pos.x * 2, y: b.pos.y * 2 }
    })),
    pockets: input.pockets.map((p) => ({
      ...p,
      mouth: p.mouth * 2,
      pos: { x: p.pos.x * 2, y: p.pos.y * 2 }
    }))
  };
  const next = planSnookerShot(scaled).bestPot!;
  expect(next.aimDir).toEqual(first.aimDir);
  expect(next.cueToTarget).toBeCloseTo(first.cueToTarget * 2);
});
test('follows real rules from red pot to colour pot to the next red', () => {
  const rules = new SnookerRoyalRules();
  const state = rules.getInitialFrame('Human', 'Bot');
  const afterRed = rules.applyShot(
    state,
    [
      { type: 'HIT', firstContact: 'RED', ballId: 'RED_1' },
      { type: 'POTTED', ball: 'RED', ballId: 'RED_1', pocket: 'TL' }
    ],
    { contactMade: true }
  );
  const input = layout([ball('BLACK', 'BLACK', 1, 0)]);
  input.frame = afterRed;
  expect(
    legalSnookerTargets(input.frame, input.balls, 'cue').map((b) => b.id)
  ).toEqual(['BLACK']);
  const afterBlack = rules.applyShot(
    afterRed,
    [
      { type: 'HIT', firstContact: 'BLACK', ballId: 'BLACK' },
      { type: 'POTTED', ball: 'BLACK', ballId: 'BLACK', pocket: 'TL' }
    ],
    { contactMade: true }
  );
  expect(
    legalSnookerTargets(afterBlack, input.balls, 'cue').map((b) => b.id)
  ).toEqual(['red1']);
  expect(afterBlack.players.A.score).toBe(8);
});
