import test from 'node:test';
import assert from 'node:assert/strict';
import { createWalletTransferService } from '../services/walletTransfer.js';

function fixture() {
  let state = {
    users: {
      a: { _id: 'a', accountId: 'sender', balance: 100, transactions: [] },
      b: { _id: 'b', accountId: 'receiver', balance: 10, transactions: [] },
      c: { _id: 'c', accountId: 'other', balance: 0, transactions: [] }
    },
    receipts: {}
  };
  let pending = Promise.resolve();
  let failAt;
  let ends = 0;
  const current = (session) => session ? session.state : state;
  const query = (read) => ({
    session: (session) => Promise.resolve(read(current(session))),
    then: (resolve, reject) => Promise.resolve(read(state)).then(resolve, reject)
  });
  const database = {
    connection: { readyState: 1 },
    async startSession() {
      return {
        async withTransaction(callback) {
          const previous = pending;
          let release;
          pending = new Promise((resolve) => { release = resolve; });
          await previous;
          this.state = structuredClone(state);
          try {
            await callback();
            if (failAt === 'commit') throw new Error('commit rejected');
            state = this.state;
          } finally { release(); }
        },
        async endSession() { ends++; }
      };
    }
  };
  const UserModel = {
    findOne(filter) {
      return query((data) => {
        const user = data.users[filter._id];
        return user && !user.isBanned ? structuredClone(user) : null;
      });
    },
    async updateOne(filter, update, { session }) {
      if (failAt === filter._id) throw new Error('write rejected');
      const user = current(session).users[filter._id];
      if (!user || user.isBanned ||
          user.balance < (filter.balance?.$gte ?? -Infinity) ||
          user.balance > (filter.balance?.$lte ?? Infinity)) return { modifiedCount: 0 };
      user.balance += update.$inc.balance;
      user.transactions.push(update.$push.transactions);
      return { modifiedCount: 1 };
    }
  };
  const TransferModel = {
    findById(id) { return query((data) => data.receipts[id] || null); },
    async create([receipt], { session }) {
      if (failAt === 'receipt') throw new Error('receipt write rejected');
      current(session).receipts[receipt._id] = structuredClone(receipt);
    }
  };
  const deps = { UserModel, TransferModel, database };
  return {
    transfer: createWalletTransferService(deps), deps,
    state: () => state,
    fail: (point) => { failAt = point; },
    ends: () => ends
  };
}

const transferInput = (overrides = {}) => ({
  senderId: 'a', receiverId: 'b', amount: 25,
  operationId: 'test-operation-00001', note: 'A gift', ...overrides
});

test('one commit conserves value and records both ledger entries and durable receipt', async () => {
  const f = fixture();
  const result = await f.transfer(transferInput());
  assert.equal(result.balance, 75);
  assert.equal(result.replayed, false);
  assert.equal(f.state().users.b.balance, 35);
  assert.equal(f.state().users.a.balance + f.state().users.b.balance, 110);
  assert.equal(Object.keys(f.state().receipts).length, 1);
  const debit = f.state().users.a.transactions[0];
  const credit = f.state().users.b.transactions[0];
  assert.equal(debit.amount + credit.amount, 0);
  assert.notEqual(debit.transactionId, credit.transactionId);
  assert.equal(f.ends(), 1);
});

for (const failAt of ['a', 'b', 'receipt', 'commit']) {
  test(`a ${failAt} failure rolls back all balances, history and receipts`, async () => {
    const f = fixture();
    const before = structuredClone(f.state());
    f.fail(failAt);
    await assert.rejects(f.transfer(transferInput()), { code: 'transfer_unavailable_retry_same_operation' });
    assert.deepEqual(f.state(), before);
    assert.equal(f.ends(), 1);
    f.fail(undefined);
    await f.transfer(transferInput());
    assert.equal(f.state().users.a.balance, 75);
  });
}

test('a retry survives service recreation and never charges or credits twice', async () => {
  const f = fixture();
  const first = await f.transfer(transferInput());
  const restartedService = createWalletTransferService(f.deps);
  const replay = await restartedService(transferInput());
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.transaction, first.transaction);
  assert.equal(f.state().users.a.balance, 75);
  assert.equal(f.state().users.b.balance, 35);
  assert.equal(f.state().users.a.transactions.length, 1);
});

test('a repeated operation with different amount, recipient or note is rejected', async () => {
  const f = fixture();
  await f.transfer(transferInput());
  for (const change of [{ amount: 26 }, { receiverId: 'c' }, { note: 'changed' }]) {
    await assert.rejects(f.transfer(transferInput(change)), { code: 'operation_id_conflict', status: 409 });
  }
  assert.equal(f.state().users.a.balance, 75);
  assert.equal(f.state().users.c.balance, 0);
});

test('concurrent duplicate retries settle exactly once', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 8 }, () => f.transfer(transferInput())));
  assert.equal(results.filter((r) => !r.replayed).length, 1);
  assert.equal(f.state().users.a.balance, 75);
  assert.equal(f.state().users.b.transactions.length, 1);
});

test('competing transfers cannot spend the same balance twice', async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    f.transfer(transferInput({ amount: 80 })),
    f.transfer(transferInput({ amount: 80, receiverId: 'c', operationId: 'test-operation-00002' }))
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'insufficient_balance');
  assert.equal(f.state().users.a.balance, 20);
  assert.equal(Object.values(f.state().users).reduce((sum, u) => sum + u.balance, 0), 110);
});

test('rejects invalid value, self transfer, missing recipient and unavailable database', async () => {
  const f = fixture();
  for (const amount of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(f.transfer(transferInput({ amount })), { code: 'amount_must_be_a_positive_safe_integer' });
  }
  for (const operationId of [undefined, '', 'short', '$'.repeat(20)]) {
    await assert.rejects(f.transfer(transferInput({ operationId })), { code: 'valid_operation_id_required' });
  }
  await assert.rejects(f.transfer(transferInput({ receiverId: 'a' })), { code: 'distinct_existing_accounts_required' });
  await assert.rejects(f.transfer(transferInput({ receiverId: 'missing' })), { code: 'account_unavailable' });
  f.deps.database.connection.readyState = 0;
  await assert.rejects(f.transfer(transferInput()), { code: 'transactional_database_unavailable', status: 503 });
  assert.equal(f.state().users.a.balance, 100);
  assert.equal(Object.keys(f.state().receipts).length, 0);
});

test('banned sender/recipient and overflowing recipient cannot receive transfers', async () => {
  for (const account of ['a', 'b']) {
    const f = fixture();
    f.state().users[account].isBanned = true;
    await assert.rejects(f.transfer(transferInput()), { code: 'account_unavailable' });
    assert.equal(f.state().users.a.balance, 100);
  }
  const f = fixture();
  f.state().users.b.balance = Number.MAX_SAFE_INTEGER;
  await assert.rejects(f.transfer(transferInput()), { code: 'recipient_balance_unavailable' });
  assert.equal(f.state().users.a.balance, 100);
});
