import test from 'node:test';
import assert from 'node:assert/strict';
import { LudoBattleGame } from '../bot/logic/ludoBattleGame.js';
import {
  LUDO_GOAL_PROGRESS,
  getLudoMovableTokens,
  getLudoCaptureVictims,
  canRollLudoDice
} from '../shared/ludoBattleRules.js';

test('entry needs six; finishing needs an exact roll and finished pieces cannot move', () => {
  assert.deepEqual(getLudoMovableTokens([-1, 51, 56, 57], 6), [0, 1]);
  assert.deepEqual(getLudoMovableTokens([-1, 51, 56, 57], 1), [1, 2]);
  for (const roll of [0, 7, null, NaN, 2.5]) {
    assert.deepEqual(getLudoMovableTokens([-1, 0, 55, 57], roll), []);
  }
});

test('all eight safe cells protect opponents with server and visual seat offsets', () => {
  for (const starts of [[0, 13, 26, 39], [26, 13, 0, 39]]) {
    for (const safe of [0, 8, 13, 21, 26, 34, 39, 47]) {
      const progress = starts.map((start) => [(safe - start + 52) % 52, -1, -1, -1]);
      assert.deepEqual(getLudoCaptureVictims(progress, 0, progress[0][0], starts), []);
    }
  }
});

test('ordinary squares capture every opponent on that cell but never home-lane pieces', () => {
  const starts = [26, 13, 0, 39];
  const progress = [[0, -1, -1, -1], [14, 14, 52, -1], [27, -1, -1, -1], [40, 57, -1, -1]];
  assert.deepEqual(getLudoCaptureVictims(progress, 0, 1, starts), [
    { player: 1, token: 0 }, { player: 1, token: 1 },
    { player: 2, token: 0 }, { player: 3, token: 0 }
  ]);
  assert.deepEqual(getLudoCaptureVictims(progress, 0, 52, starts), []);
});

test('rolling remains locked through result, selection, movement and every winner seat', () => {
  const ready = { winner: null, animation: null, pendingRoll: null, onlinePendingRoll: null };
  assert.equal(canRollLudoDice(ready), true);
  for (const winner of [0, 1, 2, 3]) assert.equal(canRollLudoDice({ ...ready, winner }), false);
  for (const patch of [{ pendingRoll: 6 }, { onlinePendingRoll: 2 }, { animation: {} }]) {
    assert.equal(canRollLudoDice({ ...ready, ...patch }), false);
  }
  for (const flag of ['rolling', 'selecting', 'resolving']) {
    assert.equal(canRollLudoDice(ready, { [flag]: true }), false);
  }
});

test('capture grants a bonus turn; landing on a safe cell does not capture', () => {
  const game = new LudoBattleGame(['a', 'b']);
  game.progress = [[9, -1, -1, -1], [1, -1, -1, -1]];
  game.pendingRoll = 5;
  assert.equal(game.move('a', 0, 0).captures.length, 1);
  assert.equal(game.snapshot().currentPlayerId, 'a');
  game.progress = [[19, -1, -1, -1], [8, -1, -1, -1]];
  game.pendingRoll = 2;
  assert.equal(game.move('a', 0, game.revision).captures.length, 0);
  assert.equal(game.progress[1][0], 8);
  assert.equal(game.snapshot().currentPlayerId, 'b');
});

test('no-move rolls advance normally, while a six retains the turn', () => {
  const game = new LudoBattleGame(['a', 'b']);
  assert.equal(game.roll('a', () => 0).state.currentPlayerId, 'b');
  game.progress[1] = [52, 53, 54, 57];
  const result = game.roll('b', () => 0.999);
  assert.deepEqual(result.movableTokens, []);
  assert.equal(result.state.currentPlayerId, 'b');
  assert.equal(result.state.pendingRoll, null);
});

test('stale commands, duplicate rolls and commands after victory preserve the snapshot', () => {
  const game = new LudoBattleGame(['a', 'b']);
  game.progress[0] = [57, 57, 57, 56];
  game.roll('a', () => 0);
  const before = game.snapshot();
  assert.equal(game.roll('a').error, 'move_required');
  assert.equal(game.move('a', 3, 0).error, 'stale_revision');
  assert.deepEqual(game.snapshot(), before);
  game.move('a', 3, game.revision);
  const won = game.snapshot();
  assert.equal(won.winner, 'a');
  assert.equal(game.roll('a').error, 'game_finished');
  assert.equal(game.move('a', 3, won.revision).error, 'game_finished');
  assert.deepEqual(game.snapshot(), won);
});

test('seeded complete matches finish legally for two, three and four players', () => {
  for (const count of [2, 3, 4]) {
    for (let seed = 1; seed <= 12; seed += 1) {
      let rng = seed;
      const random = () => {
        rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
        return rng / 4294967296;
      };
      const game = new LudoBattleGame(Array.from({ length: count }, (_, i) => `player-${i}`));
      for (let turn = 0; turn < 10000 && !game.winner; turn += 1) {
        const player = game.players[game.turn];
        const rolled = game.roll(player, random);
        assert.equal(rolled.ok, true);
        if (rolled.movableTokens.length) {
          const token = rolled.movableTokens[Math.floor(random() * rolled.movableTokens.length)];
          assert.equal(game.move(player, token, game.revision).ok, true);
        }
        for (const row of game.progress) {
          assert.equal(row.length, 4);
          assert.ok(row.every((value) => Number.isInteger(value) && value >= -1 && value <= LUDO_GOAL_PROGRESS));
        }
      }
      assert.ok(game.winner, `match with ${count} players and seed ${seed} stalled`);
      assert.deepEqual(game.progress[game.players.indexOf(game.winner)], [57, 57, 57, 57]);
    }
  }
});
