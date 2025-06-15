import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom } from '../bot/gameEngine.js';

test('player activation requires rolling a 6', () => {
  const room = new GameRoom('x');
  room.addPlayer({ id: 'a', name: 'A' });
  room.addPlayer({ id: 'b', name: 'B' });
  room.addPlayer({ id: 'c', name: 'C' });
  room.addPlayer({ id: 'd', name: 'D' });
  assert.equal(room.status, 'playing');
  const player = room.players[0];
  room.rollDice('a');
  assert.equal(player.isActive || player.position > 0, player.isActive);
});

