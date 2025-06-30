import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom, DEFAULT_SNAKES, DEFAULT_LADDERS } from '../bot/gameEngine.js';

class DummyIO {
  constructor() {
    this.events = [];
  }
  to() {
    return { emit: (e, d) => this.events.push({ event: e, data: d }) };
  }
}

test('other players receive move and turn events', () => {
  const io = new DummyIO();
  const room = new GameRoom('r', io, 2, {
    snakes: DEFAULT_SNAKES,
    ladders: DEFAULT_LADDERS,
  });
  room.rollCooldown = 0;

  const s1 = { id: 's1', join: () => {} };
  const s2 = { id: 's2', join: () => {} };
  room.addPlayer('p1', 'A', s1);
  room.addPlayer('p2', 'B', s2);
  room.startGame();

  io.events = [];
  room.rollDice(s1, 6);

  const move = io.events.find(e => e.event === 'movePlayer');
  const turn = io.events.find(e => e.event === 'turnChanged' && e.data.playerId === 'p2');
  assert.ok(move, 'movePlayer should be emitted');
  assert.ok(turn, 'turnChanged should indicate player 2');
});
