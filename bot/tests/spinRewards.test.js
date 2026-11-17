// Deterministic operator-model tests; actual MongoDB coverage lives in spinRewards.integration.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { makeMemoryModel } from './helpers/spinRewardMemoryModel.js';
const User = makeMemoryModel();
import { createSpinRewards } from '../services/spinRewards.js';

let user;
let now = 1800000000000;
const draws = [];
const service = createSpinRewards({ User, clock: () => now, random: () => draws.shift() ?? 0 });
test.beforeEach(async () => {
  await User.deleteMany({}); now = 1800000000000; draws.length = 0;
  user = await User.create({ telegramId: 123, balance: 100, transactions: [] });
});
test('server prize, minimum delay, balance and receipt commit together', async () => {
  const grant = await service.start(user._id, 'spin', randomUUID());
  assert.equal(grant.amount, 400); assert.equal(grant.readyAt, now + 15000);
  await assert.rejects(service.claim(user._id, 'spin', grant.id), { code: 'reward_not_ready' });
  assert.equal((await User.findById(user._id)).balance, 100);
  now += 15000;
  assert.equal((await service.claim(user._id, 'spin', grant.id)).balance, 500);
  const stored = await User.findById(user._id);
  assert.equal(stored.transactions.length, 1); assert.equal(stored.transactions[0].amount, 400);
  assert.equal(stored.spinRewards.spin.pending.claimed, true);
});
test('many devices starting together receive one stable pending outcome', async () => {
  const grants = await Promise.all(Array.from({ length: 16 }, () => service.start(user._id, 'spin', randomUUID())));
  assert.equal(new Set(grants.map((g) => g.id)).size, 1);
  assert.equal((await service.status(user._id, 'spin')).pending.id, grants[0].id);
  assert.equal((await service.start(user._id, 'spin', randomUUID())).id, grants[0].id);
});
test('24 duplicate claims and response retries credit once', async () => {
  const id = randomUUID(); await service.start(user._id, 'spin', id); now += 15000;
  const receipts = await Promise.all(Array.from({ length: 24 }, () => service.claim(user._id, 'spin', id)));
  assert.ok(receipts.every((r) => r.claimed && r.amount === 400));
  const stored = await User.findById(user._id);
  assert.equal(stored.balance, 500); assert.equal(stored.transactions.length, 1);
  assert.equal((await service.start(user._id, 'spin', id)).claimed, true);
  await assert.rejects(service.start(user._id, 'spin', randomUUID()), { code: 'reward_cooldown' });
});
test('two wheels and an independent atomic deposit preserve all increments', async () => {
  const spin = await service.start(user._id, 'spin', randomUUID());
  const roulette = await service.start(user._id, 'roulette', randomUUID()); now += 15000;
  await Promise.all([service.claim(user._id, 'spin', spin.id), service.claim(user._id, 'roulette', roulette.id),
    User.updateOne({ _id: user._id }, { $inc: { balance: 777 }, $push: { transactions: { transactionId: randomUUID(), amount: 777, type: 'deposit' } } })]);
  const stored = await User.findById(user._id);
  assert.equal(stored.balance, 6277); assert.equal(stored.transactions.length, 3);
});
test('free spins are awarded once and consumed once by concurrent starts', async () => {
  draws.push(7); const grant = await service.start(user._id, 'spin', randomUUID());
  assert.equal(grant.outcome, 'FREE_SPIN'); now += 15000;
  await Promise.all([service.claim(user._id, 'spin', grant.id), service.claim(user._id, 'spin', grant.id)]);
  assert.equal((await service.status(user._id, 'spin')).freeSpins, 2);
  const grants = await Promise.all(Array.from({ length: 8 }, () => service.start(user._id, 'spin', randomUUID())));
  assert.equal(new Set(grants.map((g) => g.id)).size, 1);
  assert.equal(grants[0].readyAt, now); assert.equal(grants[0].freeSpins, 1);
  await service.claim(user._id, 'spin', grants[0].id);
  assert.equal((await service.status(user._id, 'spin')).freeSpins, 1);
});
test('bonus is sum of three server draws and bomb has a zero-value receipt', async () => {
  draws.push(8, 0, 1, 2); const bonus = await service.start(user._id, 'spin', randomUUID());
  assert.deepEqual(bonus.bonusOutcomes, [400, 600, 800]); assert.equal(bonus.amount, 1800);
  now += 15000; await service.claim(user._id, 'spin', bonus.id); now += 3600000;
  draws.push(9); const bomb = await service.start(user._id, 'spin', randomUUID()); now += 15000;
  const result = await service.claim(user._id, 'spin', bomb.id);
  assert.equal(result.amount, 0); assert.equal(result.balance, 1900);
  assert.equal((await User.findById(user._id)).transactions.length, 2);
});
test('cross-account claims and invalid kinds/ids fail closed', async () => {
  const grant = await service.start(user._id, 'spin', randomUUID());
  const other = await User.create({ telegramId: 456, balance: 25 }); now += 15000;
  await assert.rejects(service.claim(other._id, 'spin', grant.id), { code: 'reward_not_found' });
  await assert.rejects(service.start(user._id, '__proto__', randomUUID()), { code: 'invalid_reward_kind' });
  await assert.rejects(service.start(user._id, ['spin'], randomUUID()), { code: 'invalid_reward_kind' });
  await assert.rejects(service.start(user._id, 'spin', { $ne: null }), { code: 'invalid_reward_id' });
  assert.equal((await User.findById(other._id)).balance, 25);
});
test('write failure does not create partial credit; the same claim can retry', async () => {
  const grant = await service.start(user._id, 'spin', randomUUID()); now += 15000;
  const failing = createSpinRewards({ User: { findOne: (...args) => User.findOne(...args),
    findOneAndUpdate: () => { throw new Error('database unavailable'); } }, clock: () => now });
  await assert.rejects(failing.claim(user._id, 'spin', grant.id), /database unavailable/);
  const before = await User.findById(user._id);
  assert.equal(before.balance, 100); assert.equal(before.transactions.length, 0);
  assert.equal((await service.claim(user._id, 'spin', grant.id)).balance, 500);
});
test('banned accounts and malformed old ledger cannot claim; no balances repaired or deleted', async () => {
  await User.updateOne({ _id: user._id }, { $set: { isBanned: true } });
  await assert.rejects(service.start(user._id, 'spin', randomUUID()), { code: 'account_not_found' });
  await User.collection.updateOne({ _id: user._id }, { $set: { isBanned: false, transactions: 'broken-ledger' } });
  await assert.rejects(service.start(user._id, 'spin', randomUUID()), { code: 'account_requires_repair' });
  assert.equal((await User.collection.findOne({ _id: user._id })).balance, 100);
});

test('old claim retry reports current entitlement state without paying again', async () => {
  draws.push(7); const first = await service.start(user._id, 'spin', randomUUID()); now += 15000;
  await service.claim(user._id, 'spin', first.id);
  const second = await service.start(user._id, 'spin', randomUUID());
  await service.claim(user._id, 'spin', second.id);
  const replay = await service.claim(user._id, 'spin', first.id);
  assert.equal(replay.freeSpins, 1); assert.equal(replay.balance, 500);
  assert.equal((await User.findById(user._id)).transactions.length, 2);
});
