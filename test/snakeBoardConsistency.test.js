import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoomManager } from '../bot/gameEngine.js';

class DummyIO {
  to() { return { emit: () => {} }; }
  emit() {}
}

function dummySocket(id) {
  return { id, join: () => {} };
}

test('players joining receive identical board', async () => {
  const manager = new GameRoomManager(new DummyIO());
  const room = await manager.getRoom('snake-2', 2);
  const firstSnakes = room.snakes;
  const firstLadders = room.ladders;

  await manager.joinRoom('snake-2', 'p1', 'A', dummySocket('s1'));
  await manager.joinRoom('snake-2', 'p2', 'B', dummySocket('s2'));
  const after = await manager.getRoom('snake-2', 2);
  assert.deepEqual(after.snakes, firstSnakes);
  assert.deepEqual(after.ladders, firstLadders);
});
