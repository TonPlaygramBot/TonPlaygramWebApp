import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoomManager } from '../bot/gameEngine.js';
import GameRoomModel from '../bot/models/GameRoom.js';

class DummyIO {
  to() {
    return { emit: () => {} };
  }
  emit() {}
}

test('concurrent getRoom returns identical boards', async () => {
  const original = GameRoomModel.findOneAndUpdate;
  const store = new Map();
  GameRoomModel.findOneAndUpdate = async (query, update, opts) => {
    let doc = store.get(query.roomId);
    if (!doc && opts.upsert) {
      const data = { ...update.$setOnInsert };
      data.snakes = new Map(Object.entries(data.snakes || {}));
      data.ladders = new Map(Object.entries(data.ladders || {}));
      data.players = [];
      doc = data;
      store.set(query.roomId, doc);
    }
    if (!doc) return null;
    return {
      ...doc,
      players: doc.players,
    };
  };

  const manager = new GameRoomManager(new DummyIO());

  const results = await Promise.all([
    manager.getRoom('snake-2', 2),
    manager.getRoom('snake-2', 2),
    manager.getRoom('snake-2', 2)
  ]);

  const first = results[0];
  for (const room of results) {
    assert.deepEqual(room.snakes, first.snakes);
    assert.deepEqual(room.ladders, first.ladders);
  }

  const again = await manager.getRoom('snake-2', 2);
  assert.deepEqual(again.snakes, first.snakes);
  assert.deepEqual(again.ladders, first.ladders);

  GameRoomModel.findOneAndUpdate = original;
});
