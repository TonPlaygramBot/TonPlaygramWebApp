import test from 'node:test';
import assert from 'node:assert/strict';
import { createLuckyDaily } from '../services/luckyDaily.js';
import { luckyDailyMemory } from './helpers/luckyDailyMemory.js';
const NOW = Date.parse('2026-11-17T12:00:00Z');
const account = () => ({ _id: 'owner', balance: 50, transactions: [] });
function setup(user = account()) { const User = luckyDailyMemory(user); return { User, service: createLuckyDaily({ User, clock: () => NOW }) }; }

test('fixed server award atomically credits balance and durable daily receipt', async () => {
  const { User, service } = setup();
  const result = await service.claim('owner');
  assert.equal(result.amount, 100); assert.equal(result.balance, 150); assert.equal(result.day, '2026-11-17');
  assert.equal(result.nextClaimAt, Date.parse('2026-11-18T00:00:00Z')); assert.equal(result.alreadyClaimed, false);
  assert.equal(User.current.transactions.length, 1); assert.equal(User.current.transactions[0].amount, 100);
  assert.equal(User.current.transactions[0].type, 'lucky'); // Existing mining/history filters.
});
test('parallel devices and lost-response retries credit exactly once', async () => {
  const { User, service } = setup();
  const results = await Promise.all(Array.from({ length: 24 }, () => service.claim('owner')));
  assert.ok(results.every(x => x.balance === 150)); assert.equal(results.filter(x => !x.alreadyClaimed).length, 1);
  await service.claim('owner'); assert.equal(User.current.balance, 150); assert.equal(User.current.transactions.length, 1);
});
test('next UTC day allows exactly one new claim regardless of client local clock', async () => {
  const { User, service } = setup(); await service.claim('owner');
  const tomorrow = createLuckyDaily({ User, clock: () => Date.parse('2026-11-18T00:00:00Z') });
  assert.equal((await tomorrow.claim('owner')).balance, 250); assert.equal((await tomorrow.claim('owner')).alreadyClaimed, true);
});
test('existing legacy daily ledger entry avoids migration double payment', async () => {
  const old = { ...account(), transactions: [{ type: 'lucky', amount: 100, date: new Date(NOW) }] };
  const { User, service } = setup(old);
  assert.equal((await service.claim('owner')).legacy, true); assert.deepEqual(User.current, old);
});
test('yesterday legacy entry and other prizes do not block today', async () => {
  const { service } = setup({ ...account(), transactions: [{ type: 'lucky', amount: 100, date: new Date(NOW - 86400000) }, { type: 'lucky', amount: 200, date: new Date(NOW) }] });
  assert.equal((await service.claim('owner')).balance, 150);
});
test('legacy entry arriving between read/write prevents duplicate daily award', async () => {
  const { User, service } = setup();
  User.beforeWrite(user => { user.balance += 100; user.transactions.push({ type: 'lucky', amount: 100, date: new Date(NOW) }); });
  assert.equal((await service.claim('owner')).legacy, true); assert.equal(User.current.balance, 150); assert.equal(User.current.transactions.length, 1);
});
test('concurrent reward/debit ledger changes retry without overwriting balance', async () => {
  for (const amount of [400, -30]) {
    const { User, service } = setup();
    User.beforeWrite(user => { user.balance += amount; user.transactions.push({ type: 'other', amount }); });
    assert.equal((await service.claim('owner')).balance, 150 + amount);
  }
});
test('missing, banned, malformed ledger and nonfinite balance fail closed', async () => {
  for (const user of [null, { ...account(), isBanned: true }, { ...account(), transactions: '[]' }, { ...account(), transactions: [null] }, { ...account(), balance: NaN }]) {
    const { service } = setup(user); await assert.rejects(service.claim('owner'));
  }
  const { service } = setup(); await assert.rejects(service.claim('other'), { code: 'account_not_found' });
});
test('write error changes nothing and retry remains safe', async () => {
  const { User, service } = setup(); User.beforeWrite(() => { throw new Error('write unavailable'); });
  await assert.rejects(service.claim('owner'), /write unavailable/); assert.deepEqual(User.current, account());
  assert.equal((await service.claim('owner')).balance, 150);
});

test('account banned before update receives no daily credit', async () => {
  const { User, service } = setup(); User.beforeWrite(user => { user.isBanned = true; });
  await assert.rejects(service.claim('owner'), { code: 'account_not_found' });
  assert.equal(User.current.balance, 50); assert.equal(User.current.transactions.length, 0);
});

test('balance-only concurrent debit is preserved by atomic increment', async () => {
  const { User, service } = setup(); User.beforeWrite(user => { user.balance -= 30; });
  assert.equal((await service.claim('owner')).balance, 120);
  assert.equal(User.current.balance, 120); assert.equal(User.current.transactions.length, 1);
});
