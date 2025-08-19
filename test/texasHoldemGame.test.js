import test from 'node:test';
import assert from 'node:assert/strict';
import { TexasHoldemGame } from '../lib/texasHoldemGame.js';

function alwaysCall() { return 'call'; }

const deck = [
  { rank: 'T', suit: 'C' },
  { rank: '6', suit: 'H' },
  { rank: '9', suit: 'H' },
  { rank: '4', suit: 'D' },
  { rank: '7', suit: 'S' },
  { rank: '5', suit: 'D' },
  { rank: '2', suit: 'C' },
  { rank: '3', suit: 'C' },
  { rank: 'J', suit: 'S' },
  { rank: 'K', suit: 'D' },
  { rank: 'Q', suit: 'H' },
  { rank: 'A', suit: 'H' },
];

test('simulates a full hand and awards pot to best player', () => {
  const game = new TexasHoldemGame(2, { deck, actions: [alwaysCall, alwaysCall] });
  const results = game.play();
  assert.deepEqual(results[0].winners, [0]);
  assert.equal(game.pot, 20);
  assert.equal(game.players[0].chips, 110);
  assert.equal(game.players[1].chips, 90);
});
