import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom, FINAL_TILE } from '../bot/gameEngine.js';

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
  room.rollCooldown = 0;
  assert.equal(room.applySnakesAndLadders(3), 22); // ladder
  assert.equal(room.applySnakesAndLadders(27), 56); // ladder
  assert.equal(room.applySnakesAndLadders(99), 7); // snake
  assert.equal(room.applySnakesAndLadders(8), 8); // none
});

test('start requires 6 and triple six skips turn', () => {
  const io = new DummyIO();
  const room = new GameRoom('r', io);
  room.rollCooldown = 0;
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

test('room starts when reaching custom capacity', () => {
  const io = new DummyIO();
  const room = new GameRoom('r2', io, 2);
  room.rollCooldown = 0;
  const s1 = { id: 's1', join: () => {} };
  const s2 = { id: 's2', join: () => {} };
  room.addPlayer('p1', 'A', s1);
  assert.equal(room.status, 'waiting');
  room.addPlayer('p2', 'B', s2);
  assert.equal(room.status, 'playing');
  const res = room.addPlayer('p3', 'C', { id: 's3', join: () => {} });
  assert.ok(res.error, 'should not allow extra players');
});

test('player wins when landing on the final tile', () => {
  const io = new DummyIO();
  const room = new GameRoom('r3', io);
  room.rollCooldown = 0;
  const socket = { id: 's1', join: () => {} };
  room.addPlayer('p1', 'Winner', socket);
  room.startGame();

  room.players[0].position = FINAL_TILE - 3;
  room.players[0].isActive = true;
  room.rollDice(socket, 3);

  assert.equal(room.players[0].position, FINAL_TILE);
  assert.equal(room.status, 'finished');
  const winEvent = io.emitted.find(e => e.event === 'gameWon');
  assert.ok(winEvent, 'gameWon should be emitted');
});

test('rolling too quickly triggers anti-cheat', () => {
  const io = new DummyIO();
  const emitted = [];
  const socket = { id: 's1', join: () => {}, emit: (e, d) => emitted.push({ event: e, data: d }) };
  const room = new GameRoom('r4', io);
  room.addPlayer('p1', 'Cheater', socket);
  room.startGame();

  room.rollDice(socket, 6); // first roll activates token
  const pos = room.players[0].position;
  room.rollCooldown = 1000;
  room.rollDice(socket, 5); // second roll immediately should be rejected

  assert.equal(room.players[0].position, pos);
  const err = emitted.find(e => e.event === 'error');
  assert.ok(err, 'error event should be emitted');
});

