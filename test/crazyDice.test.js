import test from 'node:test';
import assert from 'node:assert/strict';
import { getAIOpponentFlag } from '../webapp/src/utils/aiOpponentFlag.js';

class CrazyDiceGame {
  constructor(playerCount = 2, maxRolls = 1, aiCount = 0) {
    this.players = Array.from({ length: playerCount }, () => ({ score: 0, rolls: 0 }));
    this.maxRolls = maxRolls;
    this.current = 0;
    this.winner = null;
    this.tiePlayers = null;
    this.aiCount = aiCount;
  }

  roll(value) {
    const player = this.players[this.current];
    player.score += value;
    player.rolls += 1;

    let next = (this.current + 1) % this.players.length;
    let attempts = 0;
    while (this.players[next].rolls >= this.maxRolls && attempts < this.players.length) {
      next = (next + 1) % this.players.length;
      attempts += 1;
    }
    this.current = next;

    if (this.players.every(p => p.rolls >= this.maxRolls)) {
      const max = Math.max(...this.players.map(p => p.score));
      const leaders = this.players.filter(p => p.score === max);
      if (leaders.length === 1) {
        this.winner = this.players.indexOf(leaders[0]);
      } else {
        this.tiePlayers = leaders.map(p => this.players.indexOf(p));
        this.players.forEach(p => { p.rolls = 0; });
      }
      this.current = 0;
    }
  }

  aiTurn(value) {
    if (this.aiCount > 0 && this.current > 0) {
      this.roll(value);
    }
  }
}


test('scores accumulate and turn order cycles', () => {
  const game = new CrazyDiceGame(2, 1);
  game.roll(4); // player 0
  assert.equal(game.players[0].score, 4);
  assert.equal(game.current, 1);
  game.roll(5); // player 1
  assert.equal(game.players[1].score, 5);
  assert.equal(game.winner, 1);
});

test('tie-break resets rolls until single winner', () => {
  const game = new CrazyDiceGame(2, 1);
  game.roll(6); // p0
  game.roll(6); // p1 -> tie
  assert.deepEqual(game.tiePlayers, [0, 1]);
  assert.equal(game.players[0].rolls, 0);
  assert.equal(game.players[1].rolls, 0);
  game.roll(2); // p0
  game.roll(3); // p1
  assert.equal(game.winner, 1);
});

test('ai players roll when it is their turn', () => {
  const game = new CrazyDiceGame(2, 1, 1); // one ai opponent
  game.roll(3); // human player
  assert.equal(game.current, 1);
  game.aiTurn(4); // ai player rolls
  assert.equal(game.players[1].score, 4);
  assert.equal(game.winner, 1);
});

test('getAIOpponentFlag returns different flag', () => {
  const flag = getAIOpponentFlag('🇺🇸');
  assert.notEqual(flag, '🇺🇸');
});
