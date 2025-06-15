import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureTransactionArray } from '../bot/utils/userUtils.js';

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
