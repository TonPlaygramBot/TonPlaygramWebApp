import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom } from '../bot/gameEngine.js';

class DummyIO {
  constructor() {
    this.emitted = [];
  }
  to() {
    return { emit: (e, d) => this.emitted.push({ event: e, data: d }) };
  }
}

test('applySnakesAndLadders resolves moves', () => {
  const io = new DummyIO();
  const room = new GameRoom('r', io);
  assert.equal(room.applySnakesAndLadders(3), 22); // ladder
  assert.equal(room.applySnakesAndLadders(99), 7); // snake
  assert.equal(room.applySnakesAndLadders(8), 8); // none
});

test('start requires 6 and triple six skips turn', () => {
  const io = new DummyIO();
  const room = new GameRoom('r', io);
  const socket = { id: 's1', join: () => {} };
  room.addPlayer('p1', 'Player', socket);
  room.startGame();

  room.rollDice(socket, 4);
  assert.equal(room.players[0].position, 0);

  room.rollDice(socket, 6);
  assert.equal(room.players[0].position, 1);

  room.rollDice(socket, 6);
  assert.equal(room.players[0].position, 7);

  room.rollDice(socket, 6);
  assert.equal(room.players[0].position, 7); // third six should skip move
});

