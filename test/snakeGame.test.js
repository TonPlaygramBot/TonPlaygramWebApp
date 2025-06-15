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
  assert.equal(room.applySnakesAndLadders(2), 38); // ladder
  assert.equal(room.applySnakesAndLadders(99), 41); // snake
  assert.equal(room.applySnakesAndLadders(7), 7); // none
});

