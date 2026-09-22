import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planShot, estimateCueAfterShot } from '../lib/poolAi.js';

const ball = (id, x, y, extra = {}) => ({ id, x, y, vx: 0, vy: 0, pocketed: false, ...extra });
const request = (state = {}, options = {}) => ({
  game: 'AMERICAN_BILLIARDS', timeBudgetMs: 60, rngSeed: 42,
  state: { width: 1000, height: 500, ballRadius: 10, friction: 0.01,
    balls: [ball(0, 100, 250), ball(1, 400, 250), ball(8, 700, 400), ball(9, 600, 120)],
    pockets: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 },
      { x: 0, y: 500 }, { x: 500, y: 500 }, { x: 1000, y: 500 }], ...state }, ...options
});

test('explicit legal targets cannot be broadened by stale UI suggestions', () => {
  const result = planShot(request({ legalBallIds: [1], legalTargetSuggestion: { ballId: 9 } }));
  assert.equal(result.targetBallId, 1);
  const empty = planShot(request({ legalBallIds: [], legalTargetSuggestion: { ballId: 9 } }));
  assert.equal(empty.power, 0);
  assert.equal(empty.rationale, 'no-legal-targets');
  const stale = planShot(request({ legalBallIds: [3] }));
  assert.equal(stale.power, 0);
});

test('suggestions alone cannot authorize opponent colours or a higher rotation ball', () => {
  assert.equal(planShot(request({ myGroup: 'SOLIDS', legalTargetSuggestion: { ballId: 9 } })).targetBallId, 1);
  assert.equal(planShot(request({ legalTargetSuggestion: { ballId: 9 } }, { game: 'NINE_BALL' })).targetBallId, 1);
});

test('explicit cue id wins over a misleading zero-id object', () => {
  const result = planShot(request({ cueBallId: 16, legalBallIds: [1],
    balls: [ball(16, 100, 250), ball(0, 650, 300), ball(1, 400, 250)] }));
  assert.equal(result.targetBallId, 1);
  assert(result.aimPoint);
  assert.equal(result.angleRad, Math.atan2(result.aimPoint.y - 250, result.aimPoint.x - 100));
});

test('invalid or absent cue snapshots do not throw or invent a shot', () => {
  assert.equal(planShot({}).power, 0);
  assert.equal(planShot(request({ balls: [ball(1, 400, 250)] })).power, 0);
  assert.equal(planShot(request({ balls: [ball(0, NaN, 200), ball(1, 400, 250)] })).power, 0);
});

test('restricted ball-in-hand always returns a non-overlapping placement or refuses the shot', () => {
  const req = request({ ballInHand: true, breakPlacementRestricted: true, baulkLineY: 490,
    balls: [ball(0, 0, 0, { pocketed: true }), ball(1, 500, 250)] });
  const result = planShot(req);
  assert(result.power > 0);
  assert(result.cueBallPosition);
  assert(result.cueBallPosition.y >= 490);
  assert(result.cueBallPosition.y <= 490);
  assert(Math.hypot(result.cueBallPosition.x - 500, result.cueBallPosition.y - 250) >= 20);
  const impossible = planShot({ ...req, state: { ...req.state, baulkLineY: 499 } });
  assert.equal(impossible.power, 0);
  assert.equal(impossible.rationale, 'no-legal-cue-placement');
});

test('stun, follow and draw start from the ghost contact rather than the object centre', () => {
  const cue = { x: 100, y: 250 };
  const target = { x: 400, y: 250 };
  const pocket = { x: 1000, y: 250 };
  const table = { width: 1000, height: 500, ballRadius: 10 };
  const stun = estimateCueAfterShot(cue, target, pocket, 0.6, { top: 0, side: 0, back: 0 }, table);
  assert.equal(stun.x, 380);
  assert.equal(stun.y, 250);
  const follow = estimateCueAfterShot(cue, target, pocket, 0.6, { top: 0.5, side: 0, back: 0 }, table);
  const draw = estimateCueAfterShot(cue, target, pocket, 0.6, { top: 0, side: 0, back: 0.5 }, table);
  assert(follow.x > stun.x);
  assert(draw.x < stun.x);
});

test('a cut stun follows the perpendicular tangent and does not acquire arbitrary side travel', () => {
  const cue = { x: 100, y: 300 };
  const target = { x: 300, y: 250 };
  const pocket = { x: 500, y: 0 };
  const length = Math.hypot(200, -250);
  const normal = { x: 200 / length, y: -250 / length };
  const ghost = { x: 300 - normal.x * 20, y: 250 - normal.y * 20 };
  const result = estimateCueAfterShot(cue, target, pocket, 0.4, { top: 0, side: 0, back: 0 },
    { width: 1000, height: 500, ballRadius: 10 });
  assert(Math.abs((result.x - ghost.x) * normal.x + (result.y - ghost.y) * normal.y) < 1e-8);
});

test('supplied pocket jaws reject a physically narrower than ball opening', () => {
  const result = planShot(request({ balls: [ball(0, 100, 250), ball(1, 400, 250)],
    pockets: [{ x: 1000, y: 250, mouth: { x: 990, y: 250 }, jawA: { x: 990, y: 242 }, jawB: { x: 990, y: 258 } }] }));
  assert.equal(result.targetPocket, undefined);
  assert.match(result.rationale, /safety|kick/);
});

test('unseeded requests honor their deadline rather than running an unlimited search', () => {
  const originalNow = Date.now;
  let clockCalls = 0;
  Date.now = () => ++clockCalls * 10;
  try {
    const result = planShot(request({}, { timeBudgetMs: 1, rngSeed: undefined, liveMappingOnly: false }));
    assert(Number.isFinite(result.angleRad));
    assert(clockCalls >= 2 && clockCalls < 20, `unbounded clock checks: ${clockCalls}`);
  } finally {
    Date.now = originalNow;
  }
});

test('public worker and server planner are byte-identical', () => {
  assert.equal(readFileSync(new URL('../lib/poolAi.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../webapp/public/lib/poolAi.js', import.meta.url), 'utf8'));
});
