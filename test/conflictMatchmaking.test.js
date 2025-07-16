import test from 'node:test';
import assert from 'node:assert/strict';
import { get2PlayerConflict, get3PlayerConflict, get4PlayerConflict } from '../bot/utils/conflictMatchmaking.js';

// 8.8.8.8 is a well-known US IP
const US_IP = '8.8.8.8';

test('get2PlayerConflict returns user flag and one rival', () => {
  const result = get2PlayerConflict(US_IP);
  assert.equal(result.length, 2);
  assert.equal(result[0], '🇺🇸');
  assert.notEqual(result[0], result[1]);
});

test('get3PlayerConflict returns triangle with user flag', () => {
  const result = get3PlayerConflict(US_IP);
  assert.equal(result.length, 3);
  assert.equal(result[0], '🇺🇸');
});

test('get4PlayerConflict returns four flags in region', () => {
  const result = get4PlayerConflict('Balkans');
  assert.equal(result.length, 4);
});
