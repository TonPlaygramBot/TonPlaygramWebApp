import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBilliardsAiPlans, resolveBilliardsAiDifficulty, createBilliardsPlanCache } from '../lib/billiardsAiSelection.js';

const shot = (id, overrides = {}) => ({ id, type: 'pot', aimDir: { x: 1, y: 0 }, power: 0.5,
  quality: 0.75, potChance: 0.7, targetBall: { active: true }, ...overrides });
const choose = (options) => selectBilliardsAiPlans({
  isPlayablePlan: (plan) => !plan.blocked && !plan.scratch,
  isFirstContactLegal: (plan) => !plan.illegal,
  ...options
});

test('hard rejections never return as relaxed pots even without a safety', () => {
  for (const score of [-Infinity, Infinity, NaN]) {
    assert.equal(choose({ scoredPots: [{ plan: shot('rejected'), score }] }).bestPot, null);
  }
});

test('live legality and path checks apply to attacks and safeties', () => {
  for (const flag of ['blocked', 'scratch', 'illegal']) {
    const result = choose({ scoredPots: [{ plan: shot('pot', { [flag]: true }), score: 1 }],
      safetyShots: [shot('safe', { type: 'safety', [flag]: true })] });
    assert.equal(result.bestPot, null);
    assert.equal(result.bestSafety, null);
  }
});

test('chooses verified safety over speculative attack and retains it as fallback', () => {
  const safety = shot('cover', { type: 'safety', quality: 0.9 });
  const poor = choose({ scoredPots: [{ plan: shot('thin-cut', { potChance: 0.25 }), score: 0.9 }], safetyShots: [safety] });
  assert.equal(poor.bestPot, null);
  assert.equal(poor.bestSafety, safety);
  const good = choose({ scoredPots: [{ plan: shot('routine'), score: 0.9 }], safetyShots: [safety] });
  assert.equal(good.bestPot.id, 'routine');
  assert.equal(good.bestSafety, safety);
});

test('pocket probability outranks optimistic shape of a difficult cut', () => {
  const result = choose({ scoredPots: [
    { plan: shot('thin', { potChance: 0.4 }), score: 1 },
    { plan: shot('straight', { potChance: 0.85 }), score: 0.7 }
  ] });
  assert.equal(result.bestPot.id, 'straight');
});

test('difficulty changes selection without modifying engine-calibrated aim or power', () => {
  const pot = shot('cut', { potChance: 0.45 });
  const input = { scoredPots: [{ plan: pot, score: 0.8 }] };
  assert.equal(choose({ ...input, difficulty: 'easy' }).bestPot, null);
  assert.equal(choose({ ...input, difficulty: 'hard' }).bestPot, pot);
  assert.equal(pot.power, 0.5);
  assert.deepEqual(pot.aimDir, { x: 1, y: 0 });
  assert.equal(resolveBilliardsAiDifficulty('unknown').name, 'expert');
});

test('requires validation and rejects inactive or malformed shots', () => {
  assert.equal(selectBilliardsAiPlans({ scoredPots: [{ plan: shot('pot'), score: 1 }] }).bestPot, null);
  for (const overrides of [{ targetBall: { active: false } }, { aimDir: { x: NaN, y: 1 } },
    { aimDir: { x: 0, y: 0 } }, { power: Infinity }, { power: 0 }]) {
    assert.equal(choose({ scoredPots: [{ plan: shot('pot', overrides), score: 1 }] }).bestPot, null);
  }
});

test('unchanged table is planned once across animation frames; tiny moves and rules changes invalidate', () => {
  const cache = createBilliardsPlanCache();
  const snapshot = { variant: 'snooker', activePlayer: 1, ballOn: ['RED'], freeBall: false,
    meta: { state: { ballInHand: false, breakInProgress: false } },
    balls: [{ id: 'cue', x: 0.1, y: 0.2, active: true }, { id: 'red1', x: 1, y: 2, active: true }] };
  let calls = 0;
  const compute = () => { calls++; return { bestPot: shot('pot') }; };
  for (let frame = 0; frame < 120; frame++) cache(structuredClone(snapshot), compute);
  assert.equal(calls, 1);
  const changes = [
    (value) => { value.balls[0].x += 1e-9; },
    (value) => { value.balls[1].active = false; },
    (value) => { value.activePlayer = 0; },
    (value) => { value.ballOn = ['BLACK']; },
    (value) => { value.freeBall = true; },
    (value) => { value.meta.state.ballInHand = true; },
    (value) => { value.variant = '9ball'; }
  ];
  for (const change of changes) {
    const changed = structuredClone(snapshot);
    change(changed);
    cache(changed, compute);
  }
  assert.equal(calls, 8);
  cache.clear();
  cache(snapshot, compute);
  assert.equal(calls, 9);
});

test('cached plans isolate all mutable vectors/spin while retaining live target entity', () => {
  class Vec {
    constructor(x, y) { this.x = x; this.y = y; }
    clone() { return new Vec(this.x, this.y); }
  }
  const cache = createBilliardsPlanCache();
  const targetBall = { active: true, pos: new Vec(1, 1) };
  const original = { bestPot: shot('pot', { aimDir: new Vec(1, 0), targetBall,
    pocketCenter: new Vec(2, 2), cushionPoint: new Vec(3, 3), spin: { x: 0.1, y: 0.2 } }) };
  const first = cache({ frame: 1 }, () => original);
  first.bestPot.aimDir.x = 99;
  first.bestPot.pocketCenter.x = 99;
  first.bestPot.cushionPoint.x = 99;
  first.bestPot.spin.x = 99;
  original.bestPot.aimDir.x = 88;
  const next = cache({ frame: 1 }, () => { throw Error('must not recompute'); });
  assert.equal(next.bestPot.aimDir.x, 1);
  assert.equal(next.bestPot.pocketCenter.x, 2);
  assert.equal(next.bestPot.cushionPoint.x, 3);
  assert.equal(next.bestPot.spin.x, 0.1);
  assert.equal(next.bestPot.targetBall, targetBall);
  assert(next.bestPot.aimDir instanceof Vec);
});
