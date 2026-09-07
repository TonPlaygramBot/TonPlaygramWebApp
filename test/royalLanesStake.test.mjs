import test from 'node:test';
import assert from 'node:assert/strict';
import { createBowlingStakeService } from '../bot/services/bowlingStake.js';

// A transactional repository double exercises failures/rollback and ledger
// semantics locally. kartStakeMongo.test.mjs also runs on a real replica set.
function fixture() {
  let users = [1, 2, 3].map((i) => ({
    accountId: `alias-${i}`,
    tpcAccountNumber: `tpg-${i}`,
    balance: 1000,
    currentTableId: null,
    transactions: []
  }));
  let matches = [];
  let fault = '';
  let writes = Promise.resolve();
  function satisfies(doc, query) {
    return Object.entries(query).every(([key, value]) => {
      if (key === '$or') return value.some((q) => satisfies(doc, q));
      const actual =
        key === 'transactions.transactionId'
          ? doc.transactions.map((t) => t.transactionId)
          : doc[key];
      if (value && typeof value === 'object')
        return Object.entries(value).every(([op, expected]) => {
          if (op === '$ne')
            return Array.isArray(actual)
              ? !actual.includes(expected)
              : actual !== expected;
          if (op === '$gte') return actual >= expected;
          if (op === '$lte') return actual <= expected;
          if (op === '$in')
            return Array.isArray(actual)
              ? actual.some((v) => expected.includes(v))
              : expected.includes(actual);
          throw new Error(`Unhandled query ${op}`);
        });
      return actual === value;
    });
  }
  const query = (fn) => ({
    session: async () => fn(),
    lean: async () => fn(),
    select() {
      return this;
    }
  });
  const database = {
    connection: { readyState: 1 },
    async startSession() {
      return {
        async withTransaction(fn) {
          const operation = writes
            .catch(() => {})
            .then(async () => {
              const saved = structuredClone({ users, matches });
              try {
                await fn();
              } catch (e) {
                users = saved.users;
                matches = saved.matches;
                throw e;
              }
            });
          writes = operation;
          await operation;
        },
        async endSession() {}
      };
    }
  };
  const UserModel = {
    findOne: (q) => query(() => users.find((u) => satisfies(u, q))),
    async updateOne(q, update) {
      const user = users.find((u) => satisfies(u, q));
      if (!user) return { modifiedCount: 0 };
      if (fault && user.tpcAccountNumber === fault)
        throw new Error('injected_write_failure');
      if (update.$inc)
        for (const [k, v] of Object.entries(update.$inc)) user[k] += v;
      if (update.$set) Object.assign(user, update.$set);
      if (update.$push)
        for (const [k, v] of Object.entries(update.$push)) user[k].push(v);
      return { modifiedCount: 1 };
    }
  };
  const MatchModel = {
    findOne: (q) =>
      query(() => {
        const found = matches.find((m) => satisfies(m, q));
        return found
          ? {
              ...found,
              async save() {
                const { save, ...data } = this;
                Object.assign(found, data);
              }
            }
          : null;
      }),
    find: (q) => query(() => matches.filter((m) => satisfies(m, q))),
    async create(docs) {
      matches.push(
        ...docs.map((d) => ({ ...structuredClone(d), status: 'playing' }))
      );
    }
  };
  return {
    service: createBowlingStakeService({ database, UserModel, MatchModel }),
    users: () => users,
    matches: () => matches,
    fault: (id) => {
      fault = id;
    }
  };
}
const table = (id = 'grid-1', accounts = ['tpg-1', 'tpg-2']) => ({
  id,
  stake: 100,
  players: accounts.map((id) => ({ id, tpcAccountNumber: id }))
});

test('TPG stakes reserve only on a complete contract and settle once from server outcome', async () => {
  const f = fixture();
  await f.service.canQueue('tpg-1', 100);
  assert.deepEqual(
    f.users().map((u) => u.balance),
    [1000, 1000, 1000]
  );
  await f.service.reserve(table());
  await f.service.reserve(table());
  assert.deepEqual(
    f.users().map((u) => u.balance),
    [900, 900, 1000]
  );
  assert.equal(f.users()[0].transactions.length, 1);
  await assert.rejects(f.service.canQueue('tpg-1', 100), /active_match/);
  await assert.rejects(
    f.service.reserve(table('grid-2', ['tpg-1', 'tpg-3'])),
    /active_match/
  );
  await assert.rejects(
    f.service.settle('grid-1', { winnerAccountId: 'outsider' }),
    /winner_not_in_match/
  );
  const result = await f.service.settle('grid-1', { winnerAccountId: 'tpg-2' });
  assert.deepEqual(
    await f.service.settle('grid-1', { winnerAccountId: 'tpg-1' }),
    result
  );
  assert.equal(result.amount, 200);
  assert.deepEqual(
    f.users().map((u) => u.balance),
    [900, 1100, 1000]
  );
  assert.ok(f.users().every((u) => u.currentTableId === null));
  assert.equal(f.users()[1].transactions[1].type, 'stake_payout');
  assert.equal(f.users()[1].transactions[1].game, 'royallanes');
  assert.equal(
    f.users()[1].transactions[1].transactionId,
    'bowling:grid-1:paid:tpg-2'
  );
});

test('partial reservations and payouts roll back; refunds and restart recovery are idempotent', async () => {
  const f = fixture();
  f.fault('tpg-2');
  await assert.rejects(f.service.reserve(table()), /injected/);
  assert.deepEqual(
    f.users().map((u) => u.balance),
    [1000, 1000, 1000]
  );
  assert.equal(f.matches().length, 0);
  f.fault('');
  await assert.rejects(
    f.service.reserve(table('aliases', ['tpg-1', 'alias-1'])),
    /busy/
  );
  assert.equal(f.users()[0].balance, 1000);
  await f.service.reserve(table());
  f.fault('tpg-2');
  await assert.rejects(
    f.service.settle('grid-1', { winnerAccountId: 'tpg-1' }),
    /injected/
  );
  assert.equal(f.users()[0].balance, 900);
  assert.equal(f.matches()[0].status, 'playing');
  f.fault('');
  f.matches()[0].expiresAt = new Date(0);
  await f.service.recoverExpired();
  await f.service.recoverExpired();
  assert.deepEqual(
    f.users().map((u) => u.balance),
    [1000, 1000, 1000]
  );
  assert.equal(
    f.users()[0].transactions.filter((t) => t.type === 'stake_refund').length,
    1
  );
  assert.equal(f.matches()[0].reason, 'expired_match_refund');
});

test('competing grids cannot reserve the same TPG account twice', async () => {
  const f = fixture();
  const outcomes = await Promise.allSettled([
    f.service.reserve(table('first')),
    f.service.reserve(table('second', ['tpg-1', 'tpg-3']))
  ]);
  assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(f.users()[0].balance, 900);
  assert.equal(f.matches().length, 1);
});

test('bowling reservations cover a full ten-frame match and reject extra seats', async () => {
  const f=fixture();
  await assert.rejects(f.service.reserve(table('three',['tpg-1','tpg-2','tpg-3'])), /invalid_bowling_stake_contract/);
  const now=Date.now();await f.service.reserve(table());
  assert.ok(f.matches()[0].expiresAt.getTime()-now>=44*60_000);
});
