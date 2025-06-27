import test from 'node:test';
import assert from 'node:assert/strict';
import { canEnterGame } from '../webapp/src/utils/diceRules.js';

test('canEnterGame validates six combinations', () => {
  const valid = [
    [6, 1],
    [1, 6],
    [6, 6],
    [2, 6],
  ];
  for (const combo of valid) {
    assert.ok(canEnterGame(combo), `should allow ${combo[0]}+${combo[1]}`);
  }

  const invalid = [
    [1, 1],
    [3, 4],
    [5, 5],
  ];
  for (const combo of invalid) {
    assert.equal(canEnterGame(combo), false, `should block ${combo[0]}+${combo[1]}`);
  }
});
