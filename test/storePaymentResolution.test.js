import { test, afterEach } from '@jest/globals';
import assert from 'node:assert/strict';
import BurnedTPC from '../bot/models/BurnedTPC.js';
import { resolvePayment } from '../bot/routes/store.js';

const originalFindOne = BurnedTPC.findOne;

afterEach(() => {
  BurnedTPC.findOne = originalFindOne;
});

test('resolvePayment uses account balance when txHash is not provided', async () => {
  const user = { balance: 150, transactions: [] };
  const result = await resolvePayment({ user, accountId: 'acc-1', totalPrice: 100, txHash: '' });

  assert.equal(result.error, undefined);
  assert.equal(result.kind, 'balance');
  assert.equal(result.balance, 150);
  assert.equal(result.paymentToken, 'TPC');
});

test('resolvePayment accepts confirmed txHash payment and does not require balance', async () => {
  let saveCalls = 0;
  BurnedTPC.findOne = async (query) => {
    assert.equal(query.txHash, '0xabc');
    assert.equal(query.verified, true);
    assert.equal(query.recipient, 'acc-2');
    return {
      amount: 220,
      async save() {
        saveCalls += 1;
      }
    };
  };

  const user = { balance: 0, transactions: [] };
  const result = await resolvePayment({ user, accountId: 'acc-2', totalPrice: 200, txHash: ' 0xabc ' });

  assert.equal(result.error, undefined);
  assert.equal(result.kind, 'confirmed-transfer');
  assert.equal(result.txHash, '0xabc');
  assert.equal(saveCalls, 1);
});

test('resolvePayment rejects unconfirmed txHash payments', async () => {
  BurnedTPC.findOne = async () => null;

  const user = { balance: 0, transactions: [] };
  const result = await resolvePayment({ user, accountId: 'acc-3', totalPrice: 90, txHash: '0xdead' });

  assert.equal(result.status, 409);
  assert.match(result.error, /not confirmed yet/i);
});
