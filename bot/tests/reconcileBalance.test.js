import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { reconcileBalanceSnapshot } from '../utils/reconcileBalance.js';

function model(initial, beforeUpdate = () => {}) {
  let current = structuredClone(initial), writes = 0;
  const collection = {
    get current() { return current; }, get writes() { return writes; },
    async findOneAndUpdate(filter, update, options) {
      beforeUpdate(current, (next) => { current = next; });
      assert.deepEqual(options, { returnDocument: 'after', includeResultMetadata: false });
      assert.deepEqual(Object.keys(update), ['$set']);
      assert.deepEqual(Object.keys(update.$set), ['balance']);
      if (!current || filter._id !== current._id) return null;
      for (const key of ['balance', 'transactions']) {
        const condition = filter[key];
        if ('$exists' in condition ? key in current : !isDeepStrictEqual(current[key], condition.$eq)) return null;
      }
      writes++;
      current.balance = update.$set.balance;
      return structuredClone(current);
    },
    async findOne(filter) { assert.equal(filter._id, initial._id); return structuredClone(current); }
  };
  return { collection, hydrate: value => value, get current() { return collection.current; }, get writes() { return collection.writes; } };
}
const account = () => ({ _id: 'owner', balance: 50, transactions: [{ amount: 100 }] });

test('legacy upward repair updates only balance, never mutates snapshot or ledger', async () => {
  const user = account(), db = model(user);
  const result = await reconcileBalanceSnapshot(user, db);
  assert.equal(result.balance, 100); assert.equal(db.writes, 1);
  assert.deepEqual(user, account()); assert.deepEqual(db.current.transactions, user.transactions);
});
test('a concurrent reward is not overwritten by a stale repair', async () => {
  const db = model(account(), u => { u.balance += 400; u.transactions.push({ amount: 400 }); });
  const result = await reconcileBalanceSnapshot(account(), db);
  assert.equal(result.balance, 450); assert.equal(db.writes, 0);
});
test('a concurrent debit is not reversed by a stale repair', async () => {
  const db = model(account(), u => { u.balance -= 30; u.transactions.push({ amount: -30 }); });
  const result = await reconcileBalanceSnapshot(account(), db);
  assert.equal(result.balance, 20); assert.equal(db.writes, 0);
});
test('ledger-only updates prevent repair even if balance is unchanged', async () => {
  const db = model(account(), u => { u.transactions.push({ amount: -80 }); });
  const result = await reconcileBalanceSnapshot(account(), db);
  assert.equal(result.balance, 50); assert.equal(db.writes, 0);
});
test('deletion during repair returns missing without upsert', async () => {
  const db = model(account(), (_, replace) => replace(null));
  assert.equal(await reconcileBalanceSnapshot(account(), db), null); assert.equal(db.writes, 0);
});
test('simultaneous read repairs apply once', async () => {
  const db = model(account());
  const results = await Promise.all([reconcileBalanceSnapshot(account(), db), reconcileBalanceSnapshot(account(), db)]);
  assert.deepEqual(results.map(u => u.balance), [100, 100]); assert.equal(db.writes, 1);
});
test('larger persisted funds are untouched and do not issue writes', async () => {
  const user = { ...account(), balance: 200 };
  const db = model(user);
  assert.deepEqual(await reconcileBalanceSnapshot(user, db), user); assert.equal(db.writes, 0);
});
test('legacy string ledger can be read without normalizing stored data', async () => {
  const user = { ...account(), transactions: '[{"amount":100}]' }, db = model(user);
  assert.equal((await reconcileBalanceSnapshot(user, db)).balance, 100);
  assert.equal(db.current.transactions, user.transactions);
});
test('write errors propagate without fallback stale document save', async () => {
  await assert.rejects(reconcileBalanceSnapshot(account(), { collection: { async findOne() { return account(); }, findOneAndUpdate() { throw new Error('offline'); } } }), /offline/);
});

test('hydrated legacy defaults never enter raw snapshot equality or persisted ledger', async () => {
  const { default: User } = await import('../models/User.js');
  const { Types } = await import('mongoose');
  const raw = { _id: new Types.ObjectId(), balance: 50, transactions: [{ amount: 100, type: 'daily' }] };
  const user = User.hydrate(raw);
  const original = structuredClone(raw.transactions);
  let attempted = false;
  const result = await reconcileBalanceSnapshot(user, {
    hydrate: value => User.hydrate(value),
    collection: {
      async findOneAndUpdate(filter, update) {
        attempted = true;
        assert.deepEqual(filter.transactions.$eq, original);
        assert.deepEqual(update, { $set: { balance: 100 } });
        return { ...raw, balance: 100 };
      },
      async findOne(filter) { assert.equal(String(filter._id), String(raw._id)); return raw; }
    }
  });
  assert.equal(attempted, true); assert.equal(result.balance, 100);
  assert.deepEqual(raw.transactions, original);
});
