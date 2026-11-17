// Deterministic operator model; real Mongo is a separate release gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createSpinRewards, selectReward, NUMERIC_SEGMENTS } from '../services/spinRewards.js';
import { createLuckyDaily } from '../services/luckyDaily.js';
import { makeMemoryModel } from './helpers/spinRewardMemoryModel.js';
const User = makeMemoryModel();
let user, now, draws;
const service = createSpinRewards({ User, clock: () => now, random: () => draws.shift() ?? 0 });
test.beforeEach(async () => {
  await User.deleteMany({}); now = 1800000000000; draws = [];
  user = await User.create({ balance: 100, transactions: [] });
});
function reward(...values) { return selectReward('lucky', () => values.shift() ?? 0); }

test('exact intended prize probabilities and uniform numeric pool match legacy logic', () => {
  const counts = { BONUS_X3: 0, FREE_SPIN: 0, numeric: 0 };
  for (let chance = 0; chance < 100; chance++) {
    const grant = reward(0, 0, 0, chance, 0, 0, 0);
    counts[typeof grant.outcome === 'number' ? 'numeric' : grant.outcome]++;
  }
  assert.deepEqual(counts, { BONUS_X3: 15, FREE_SPIN: 15, numeric: 70 });
  assert.deepEqual(NUMERIC_SEGMENTS, [400, 600, 800, 1000, 1200, 1400, 1600]);
});
test('two d6, card index and numeric suit multipliers preserve existing economics', () => {
  const suits = ['hearts', 'spades', 'diamonds', 'clubs'];
  for (let suit = 0; suit < 4; suit++) {
    const grant = reward(5, 5, suit, 30, 0);
    assert.deepEqual(grant.dice, [6, 6]); assert.equal(grant.cardIndex, 10);
    assert.equal(grant.suit, suits[suit]); assert.equal(grant.baseOutcome, 400);
    assert.equal(grant.outcome, [800, 200, 600, 300][suit]); assert.equal(grant.amount, grant.outcome);
  }
});
test('bonus X3 is sum of three numeric draws, not a suit multiplier or prize times3', () => {
  const grant = reward(0, 0, 0, 0, 0, 1, 2);
  assert.equal(grant.outcome, 'BONUS_X3'); assert.deepEqual(grant.bonusOutcomes, [400, 600, 800]);
  assert.equal(grant.amount, 1800);
});
test('Lucky grant persists outcomes, requires15 seconds, limits rolls to4 hours', async () => {
  draws = [1, 2, 3, 99, 6];
  const grant = await service.start(user._id, 'lucky', randomUUID());
  assert.deepEqual(grant.dice, [2, 3]); assert.equal(grant.cardIndex, 3); assert.equal(grant.outcome, 1200);
  assert.equal(grant.nextSpinAt, now + 15000 + 14400000);
  assert.equal((await service.start(user._id, 'lucky', randomUUID())).id, grant.id);
  await assert.rejects(service.claim(user._id, 'lucky', grant.id), { code: 'reward_not_ready' });
  now += 60000;
  const claimed = await service.claim(user._id, 'lucky', grant.id);
  assert.equal(claimed.balance, 1300); assert.equal(claimed.nextSpinAt, now + 14400000);
  await assert.rejects(service.start(user._id, 'lucky', randomUUID()), { code: 'reward_cooldown' });
});
test('parallel Lucky devices receive same pending grant and claim one payout', async () => {
  draws = [0, 0, 0, 30, 0];
  const starts = await Promise.all(Array.from({ length: 20 }, () => service.start(user._id, 'lucky', randomUUID())));
  assert.equal(new Set(starts.map(x => x.id)).size, 1);
  now += 15000;
  const claims = await Promise.all(starts.map(grant => service.claim(user._id, 'lucky', grant.id)));
  assert.ok(claims.every(x => x.balance === 900));
  assert.equal((await User.findById(user._id)).transactions.length, 1);
});
test('Lucky FREE_SPIN atomically grants2 to spin, not Lucky, and retry cannot duplicate', async () => {
  draws = [0, 0, 0, 15];
  const grant = await service.start(user._id, 'lucky', randomUUID()); now += 15000;
  const result = await service.claim(user._id, 'lucky', grant.id);
  assert.equal(result.amount, 0); assert.equal(result.freeSpins, 0); assert.equal(result.spinFreeSpins, 2);
  assert.equal((await service.status(user._id, 'spin')).freeSpins, 2);
  const spin = await service.start(user._id, 'spin', randomUUID());
  assert.equal(spin.readyAt, now); assert.equal(spin.freeSpins, 1);
  const retry = await service.claim(user._id, 'lucky', grant.id);
  assert.equal(retry.spinFreeSpins, 1); assert.equal(retry.balance, 100);
});
test('Lucky free entitlement and simultaneous spin consumption do not lose or duplicate count', async () => {
  await User.updateOne({ _id: user._id }, { $set: { 'spinRewards.spin.freeSpins': 1 } });
  draws = [0, 0, 0, 15];
  const lucky = await service.start(user._id, 'lucky', randomUUID()); now += 15000;
  await Promise.all([service.claim(user._id, 'lucky', lucky.id), service.start(user._id, 'spin', randomUUID())]);
  assert.equal((await service.status(user._id, 'spin')).freeSpins, 2);
});
test('Lucky X3 credits immediately once and does not consume ordinary spin cooldown/entitlements', async () => {
  draws = [0, 0, 0, 0, 0, 1, 2];
  const lucky = await service.start(user._id, 'lucky', randomUUID()); now += 15000;
  assert.equal((await service.claim(user._id, 'lucky', lucky.id)).balance, 1900);
  assert.equal((await service.claim(user._id, 'lucky', lucky.id)).balance, 1900);
  assert.equal((await service.status(user._id, 'spin')).nextSpinAt, 0);
  assert.equal((await service.status(user._id, 'spin')).freeSpins, 0);
});

test('Lucky and Spin free-spin awards arriving together accumulate rather than overwrite', async () => {
  draws = [7];
  const spin = await service.start(user._id, 'spin', randomUUID());
  draws = [0, 0, 0, 15];
  const lucky = await service.start(user._id, 'lucky', randomUUID()); now += 15000;
  await Promise.all([service.claim(user._id, 'spin', spin.id), service.claim(user._id, 'lucky', lucky.id)]);
  assert.equal((await service.status(user._id, 'spin')).freeSpins, 4);
  assert.equal((await User.findById(user._id)).transactions.length, 2);
  await service.claim(user._id, 'lucky', lucky.id);
  assert.equal((await service.status(user._id, 'spin')).freeSpins, 4);
});


test('daily100, Lucky numeric and Spin credit together without overwriting each other', async () => {
  draws = [0];
  const spin = await service.start(user._id, 'spin', randomUUID());
  draws = [0, 0, 0, 30, 0];
  const lucky = await service.start(user._id, 'lucky', randomUUID()); now += 15000;
  await Promise.all([
    service.claim(user._id, 'spin', spin.id),
    service.claim(user._id, 'lucky', lucky.id),
    createLuckyDaily({ User, clock: () => now }).claim(user._id)
  ]);
  const stored = await User.findById(user._id);
  assert.equal(stored.balance, 1400); assert.equal(stored.transactions.length, 3);
});
