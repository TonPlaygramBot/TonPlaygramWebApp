import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureTransactionArray,
  resolveAccountBalance
} from '../bot/utils/userUtils.js';

test('ensureTransactionArray parses valid JSON', () => {
  const user = { transactions: JSON.stringify([{ amount: 10 }]) };
  ensureTransactionArray(user);
  assert.deepEqual(user.transactions, [{ amount: 10 }]);
});

test('ensureTransactionArray handles invalid JSON', () => {
  const user = { transactions: 'invalid' };
  ensureTransactionArray(user);
  assert.deepEqual(user.transactions, []);
});

test('resolveAccountBalance preserves persisted funds when a legacy ledger is incomplete', () => {
  const user = { balance: 500, transactions: [{ amount: 100 }] };
  assert.equal(resolveAccountBalance(user), 500);
});

test('resolveAccountBalance does not restore spent funds from legacy transaction history', () => {
  const user = {
    balance: 100,
    transactions: [{ amount: 250 }, { amount: -25 }]
  };
  assert.equal(resolveAccountBalance(user), 100);
});
