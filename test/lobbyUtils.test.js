import test from 'node:test';
import assert from 'node:assert/strict';
import { canStartGame } from '../webapp/src/utils/lobby.js';

const dummyTable = { id: 't1' };

test('cannot start without stake', () => {
  assert.equal(canStartGame('snake', dummyTable, { token: '', amount: 0 }), false);
});

test('cannot start without table when required', () => {
  assert.equal(canStartGame('snake', null, { token: 'TON', amount: 100 }), false);
});

test('can start when table and stake present', () => {
  assert.equal(canStartGame('snake', dummyTable, { token: 'TON', amount: 100 }), true);
});
