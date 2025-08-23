import test from 'node:test';
import assert from 'node:assert/strict';
import { BlackjackGame } from '../examples/blackjack/gameLogic.js';

test('raise forces other players to act', () => {
  const game = new BlackjackGame('room');
  game.addPlayer('a');
  game.addPlayer('b');
  game.start();

  game.raise('a', 50);
  const bob = game.players.find(p => p.id === 'b');
  assert.equal(bob.acted, false);

  game.call('b');
  assert.equal(game.allPlayersCalled(), true);
});

test('player may re-raise after calling', () => {
  const game = new BlackjackGame('room');
  game.addPlayer('a');
  game.addPlayer('b');
  game.start();

  game.raise('b', 50);
  game.call('a');
  game.raise('a', 50);

  assert.equal(game.currentBet, 200);
  const bob = game.players.find(p => p.id === 'b');
  assert.equal(bob.acted, false);
});

test('standing keeps hand static when others hit', () => {
  const game = new BlackjackGame('room');
  game.addPlayer('a');
  game.addPlayer('b');
  game.start();
  game.startHitPhase();
  const alice = game.players.find(p => p.id === 'a');
  alice.hand = [
    { rank: 'J', suit: 'hearts' },
    { rank: 'J', suit: 'spades' }
  ];
  game.stand('a');
  const before = game.getBestValue(alice.hand);
  game.hit('b');
  assert.equal(game.getBestValue(alice.hand), before);
});

