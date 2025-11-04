import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'timers/promises';
import {
  GameRoom,
  FINAL_TILE,
  DEFAULT_SNAKES,
  DEFAULT_LADDERS,
} from '../bot/gameEngine.js';

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
  const room = new GameRoom('r', io, 4, {
    snakes: DEFAULT_SNAKES,
    ladders: DEFAULT_LADDERS,
  });
  room.rollCooldown = 0;
  assert.equal(room.applySnakesAndLadders(3), 22); // ladder
  assert.equal(room.applySnakesAndLadders(27), 46); // ladder
  assert.equal(room.applySnakesAndLadders(99), 80); // snake
  assert.equal(room.applySnakesAndLadders(8), 8); // none
});

test('start requires 6 and rolling 6 does not grant extra turn', () => {
  const io = new DummyIO();
  const room = new GameRoom('r', io, 2, {
    snakes: DEFAULT_SNAKES,
    ladders: DEFAULT_LADDERS,
  });
  room.rollCooldown = 0;
  const s1 = { id: 's1', join: () => {}, emit: () => {} };
  const s2 = { id: 's2', join: () => {}, emit: () => {} };
  room.addPlayer('p1', 'Player1', s1);
  room.addPlayer('p2', 'Player2', s2);
  room.startGame();

  room.rollDice(s1, 4);
  assert.equal(room.players[0].position, 0);
  assert.equal(room.currentTurn, 1);

  room.rollDice(s2, 6);
  assert.equal(room.players[1].position, 1);
  assert.equal(room.currentTurn, 0);

  room.rollDice(s1, 6);
  assert.equal(room.players[0].position, 1);
  assert.equal(room.currentTurn, 1);
});

test('rolling multiple sixes does not skip turn', () => {
  const io = new DummyIO();
  const room = new GameRoom('r1', io, 1, {
    snakes: DEFAULT_SNAKES,
    ladders: DEFAULT_LADDERS,
  });
  room.rollCooldown = 0;
  const socket = { id: 's1', join: () => {}, emit: () => {} };
  room.addPlayer('p1', 'Player', socket);
  room.startGame();

  room.rollDice(socket, 6);
  room.rollDice(socket, 6);
  room.rollDice(socket, 6);
  assert.equal(room.players[0].position, 13);
});

test('room starts when reaching custom capacity', async () => {
  const io = new DummyIO();
  const room = new GameRoom('r2', io, 2, {
    snakes: DEFAULT_SNAKES,
    ladders: DEFAULT_LADDERS,
  });
  room.gameStartDelay = 0;
  room.rollCooldown = 0;
  const s1 = { id: 's1', join: () => {}, emit: () => {} };
  const s2 = { id: 's2', join: () => {}, emit: () => {} };
  room.addPlayer('p1', 'A', s1);
  assert.equal(room.status, 'waiting');
  room.addPlayer('p2', 'B', s2);
  await delay(0);
  assert.equal(room.status, 'playing');
  const res = room.addPlayer('p3', 'C', { id: 's3', join: () => {} });
  assert.ok(res.error, 'should not allow extra players');
});

test('joining player receives full player list', () => {
  const io = new DummyIO();
  const events = [];
  const room = new GameRoom('r6', io, 3, {
    snakes: DEFAULT_SNAKES,
    ladders: DEFAULT_LADDERS,
  });
  const s1 = { id: 's1', join: () => {}, emit: () => {} };
  const s2 = { id: 's2', join: () => {}, emit: (e,d)=>events.push({event:e,data:d}) };
  room.addPlayer('p1', 'A', s1);
  room.addPlayer('p2', 'B', s2);
  const cur = events.find(e => e.event === 'currentPlayers');
  assert.ok(cur, 'currentPlayers event should be sent');
  assert.ok(cur.data && Array.isArray(cur.data.players), 'payload should include players array');
  assert.equal(cur.data.players.length, 2);
  assert.equal(cur.data.maxPlayers, 3);
});

test('player wins when landing on the final tile', () => {
  const io = new DummyIO();
  const room = new GameRoom('r3', io, 4, {
    snakes: DEFAULT_SNAKES,
    ladders: DEFAULT_LADDERS,
  });
  room.rollCooldown = 0;
  const socket = { id: 's1', join: () => {}, emit: () => {} };
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
  const room = new GameRoom('r4', io, 4, {
    snakes: DEFAULT_SNAKES,
    ladders: DEFAULT_LADDERS,
  });
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

test('repeated cheating results in removal', () => {
  const io = new DummyIO();
  const emitted = [];
  const socket = { id: 'sKick', join: () => {}, emit: (e, d) => emitted.push({ event: e, data: d }) };
  const room = new GameRoom('rKick', io, 1, { snakes: DEFAULT_SNAKES, ladders: DEFAULT_LADDERS });
  room.addPlayer('p1', 'Cheater', socket);
  room.startGame();

  room.rollCooldown = 1000;
  room.rollDice(socket, 6); // valid roll
  // Three rapid rolls to trigger warnings
  room.rollDice(socket, 2);
  room.rollDice(socket, 2);
  room.rollDice(socket, 2);

  const warnings = emitted.filter(e => e.event === 'cheatWarning');
  assert.ok(warnings.length >= 3, 'should emit cheat warnings');
  assert.ok(room.players[0].disconnected, 'player should be removed after cheating');
});

test('landing on another player sends them to start', () => {
  const io = new DummyIO();
  const room = new GameRoom('r5', io, 2, {
    snakes: {},
    ladders: {},
  });
  room.rollCooldown = 0;
  const s1 = { id: 's1', join: () => {}, emit: () => {} };
  const s2 = { id: 's2', join: () => {}, emit: () => {} };
  room.addPlayer('p1', 'A', s1);
  room.addPlayer('p2', 'B', s2);
  room.startGame();

  room.players[0].isActive = true;
  room.players[0].position = 1;
  room.players[1].isActive = true;
  room.players[1].position = 3;
  room.currentTurn = 0;

  room.rollDice(s1, 2); // land on player 2

  assert.equal(room.players[0].position, 3);
  assert.equal(room.players[1].position, 0);
  const resetEvent = io.emitted.find(e => e.event === 'playerReset');
  assert.ok(resetEvent && resetEvent.data.playerId === 'p2');
});

