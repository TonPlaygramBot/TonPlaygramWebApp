import test from 'node:test';
import assert from 'node:assert/strict';
import { canStartGame } from '../webapp/src/utils/lobby.js';

const dummyTable = { id: 't1', capacity: 2 };

test('single player snake requires ai count and stake', () => {
  assert.equal(
    canStartGame('snake', { id: 'single' }, { token: '', amount: 0 }, 0, 0),
    false,
  );
  assert.equal(
    canStartGame('snake', { id: 'single' }, { token: '', amount: 0 }, 2, 0),
    false,
  );
  assert.equal(
    canStartGame('snake', { id: 'single' }, { token: 'TPC', amount: 100 }, 2, 0),
    true,
  );
});

test('cannot start without stake', () => {
  assert.equal(canStartGame('snake', dummyTable, { token: '', amount: 0 }, 0, 2), false);
});

test('cannot start without table when required', () => {
  assert.equal(canStartGame('snake', null, { token: 'TPC', amount: 100 }, 0, 0), false);
});

test('can start when table and stake present', () => {
  assert.equal(canStartGame('snake', dummyTable, { token: 'TPC', amount: 100 }, 0, 2), true);
});

test('cannot start until lobby full', () => {
  assert.equal(
    canStartGame('snake', dummyTable, { token: 'TPC', amount: 100 }, 0, 1),
    false,
  );
  assert.equal(
    canStartGame('snake', dummyTable, { token: 'TPC', amount: 100 }, 0, 2),
    true,
  );
});

test('starting over capacity not allowed', () => {
  assert.equal(
    canStartGame('snake', dummyTable, { token: 'TPC', amount: 100 }, 0, 3),
    false,
  );
});
