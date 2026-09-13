import test from 'node:test';
import assert from 'node:assert/strict';
import { TABLETOP_IDS } from '../webapp/src/games/tabletop/shared/catalog.mjs';
import {
  createGame,
  applyAction,
  legalActions,
  activePlayer,
  chooseAiAction,
  publicGame,
  forfeitPlayer
} from '../webapp/src/games/tabletop/shared/engine.mjs';
const roster = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
for (const game of TABLETOP_IDS)
  for (const count of [2, 3, 4])
    test(`${game}: ${count} players finish a legal AI match`, () => {
      for (const seed of [1, 42, 9876]) {
        let s = createGame(game, roster(count), seed),
          moves = 0;
        while (!s.done && moves++ < 3000) {
          const original = JSON.stringify(s),
            id = chooseAiAction(s);
          assert.ok(id, `no moves at ${s.phase}`);
          const result = applyAction(s, activePlayer(s).id, id);
          assert.equal(result.ok, true);
          assert.equal(JSON.stringify(s), original, 'input mutated');
          s = result.state;
          for (const p of s.players) {
            assert.ok(p.cash >= 0);
            assert.ok([...p.resources, ...p.gems].every((v) => v >= 0));
          }
        }
        assert.ok(s.done, `${game} did not terminate`);
        assert.ok(
          s.players.some((p) => p.id === s.winnerAccountId) ||
            s.winnerAccountId === ''
        );
      }
    });
for (const game of TABLETOP_IDS)
  test(`${game}: rejects forged/out-of-turn/stale actions and hides secrets`, () => {
    const s = createGame(game, roster(2), 42),
      a = legalActions(s)[0].id;
    assert.equal(applyAction(s, 'p1', a).error, 'not_your_turn');
    assert.equal(applyAction(s, 'p0', 'win').error, 'illegal_action');
    assert.equal(applyAction(s, 'p0', a, 100).error, 'stale_revision');
    const view = publicGame(s, 'p1');
    assert.equal(view.rng, undefined);
    assert.equal(view.deck, undefined);
    assert.deepEqual(view.actions, []);
    assert.equal(forfeitPlayer(s, 'p0').winnerAccountId, 'p1');
  });
test('Oligarchs auctions pay only the winning legal bid', () => {
  let s = createGame('oligarchs', roster(3), 1);
  s.phase = 'offer';
  s.players[0].position = 1;
  for (const id of ['auction', 'bid', 'pass', 'pass']) {
    const r = applyAction(s, activePlayer(s).id, id);
    assert.equal(r.ok, true);
    s = r.state;
  }
  assert.equal(s.board[1].owner, 0);
  assert.equal(s.players[0].cash, 680);
  assert.equal(s.auction, null);
});
test('Oligarchs pays rent and liquidates debt without negative balances', () => {
  let s = createGame('oligarchs', roster(2), 1);
  s.players[0].cash = 1;
  s.board.forEach((c) => {
    if (c.kind === 'property') {
      c.owner = 1;
      c.level = 3;
    }
  });
  let r = applyAction(s, 'p0', 'roll');
  assert.equal(r.ok, true);
  assert.ok(r.state.players.every((p) => p.cash >= 0));
});
test('Mosaic completed rows score and empty for the next draft', () => {
  let s = createGame('mosaicroyal', roster(2), 1);
  s.factories = [[], [], []];
  s.center = [0];
  s.players[0].rows[0] = { color: -1, count: 0 };
  s = applyAction(s, 'p0', 'draft:3:0:0').state;
  assert.equal(s.players[0].wall[0][0], true);
  assert.equal(s.players[0].score, 1);
  assert.equal(s.round, 2);
  assert.equal(s.players[0].rows[0].count, 0);
});
test('Gem purchases return paid gems and apply permanent discounts', () => {
  let s = createGame('gemsyndicate', roster(2), 1);
  const card = s.market[0];
  s.players[0].gems = [20, 20, 20];
  const before = [...s.bank];
  s = applyAction(s, 'p0', `purchase:${card.id}`).state;
  assert.equal(s.players[0].bonuses[card.color], 1);
  assert.deepEqual(
    s.bank,
    before.map((n, i) => n + card.cost[i])
  );
});

test('Oligarchs auction finishes safely after the auction opener forfeits', () => {
  let s = createGame('oligarchs', roster(4), 1);
  s.phase = 'offer';
  s.players[0].position = 1;
  s = applyAction(s, 'p0', 'auction').state;
  s = applyAction(s, 'p0', 'pass').state;
  s = forfeitPlayer(s, 'p0');
  s = applyAction(s, 'p1', 'bid').state;
  s = applyAction(s, 'p2', 'pass').state;
  s = applyAction(s, 'p3', 'pass').state;
  assert.equal(s.auction, null);
  assert.equal(activePlayer(s).id, 'p1');
  assert.equal(s.phase, 'roll');
});
test('Server entropy is consumed but never exposed in public snapshots', () => {
  const s = createGame('gemsyndicate', roster(2), 1, Array(128).fill(88));
  assert.ok(s.entropy.length < 128);
  assert.equal(publicGame(s, 'p0').entropy, undefined);
});
