import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureTransactionArray } from '../bot/utils/userUtils.js';

function makeUser(transactions) {
  return { transactions };
}

test('returns false for falsy user', () => {
  assert.equal(ensureTransactionArray(null), false);
});

test('parses valid JSON and reports modification', () => {
  const user = makeUser('[{"amount":1}]');
  assert.equal(ensureTransactionArray(user), true);
  assert.deepEqual(user.transactions, [{ amount: 1 }]);
});

test('ensureTransactionArray parses valid JSON (stringified)', () => {
  const user = { transactions: JSON.stringify([{ amount: 10 }]) };
  ensureTransactionArray(user);
  assert.deepEqual(user.transactions, [{ amount: 10 }]);
});

test('ensureTransactionArray handles invalid JSON', () => {
  const user = { transactions: 'invalid' };
  ensureTransactionArray(user);
  assert.deepEqual(user.transactions, []);
});

test('initializes non-array values to empty array', () => {
  const user = makeUser({});
  assert.equal(ensureTransactionArray(user), true);
  assert.deepEqual(user.transactions, []);
});

test('does nothing for arrays', () => {
  const user = makeUser([]);
  assert.equal(ensureTransactionArray(user), false);
  assert.deepEqual(user.transactions, []);
});
