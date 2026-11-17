import { readFile } from 'node:fs/promises';
import { captureSnakeJournalResult } from '../services/settlement/snakeDurableRules.js';
import { SnakeGame as FrozenGame } from '../services/settlement/rules/snakeV1.js';
import { SnakeGame as LegacyGame } from '../logic/snakeGame.js';
import { journalHash } from '../services/settlement/snakeDurableRules.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeSnakeJournal, applySnakeJournalRoll, replaySnakeJournal, snakeRoomFromJournal } from '../services/settlement/snakeDurableRules.js';
import { snakeJournalRulesHash } from '../services/settlement/snakeDurableRules.js';
const snakeRulesHash = board => snakeJournalRulesHash('snake-server-single-die-v1', board);
const board = { snakes: {}, ladders: {}, diceCells: {} };
function fixture() {
  const match = { matchId: 'm', roomId: 'room', rulesVersion: 'snake-server-single-die-v1', rulesHash: snakeRulesHash(board), reservations: [{ accountId: 'a' }, { accountId: 'b' }], turnOrder: ['a', 'b'] };
  const initial = initializeSnakeJournal(match, board, match.turnOrder, 1000); let state = initial.state; const records = [initial.genesis];
  for (let i = 0; i < 10; i++) { const applied = applySnakeJournalRoll(state, { actor: 'a', requestId: `r${i}`, dice: i === 9 ? 1 : 6, at: 1001 + i * 1000 }); state = applied.state; records.push(applied.move); }
  return { match, state, records, initial };
}
test('full journal replays exact existing server rules and yields finished server room', () => {
  const f = fixture(); const recovered = replaySnakeJournal(f.match, f.records, f.state);
  assert.deepEqual(recovered, f.state); assert.equal(recovered.current.players[0].position, 50);
  const room = snakeRoomFromJournal(f.match, recovered); assert.equal(room.players, room.game.players); assert.equal(room.settlementMatchId, 'm');
});
for (const [name, mutate] of [
 ['die', f => { f.records[1].dice = 1; }], ['outcome', f => { f.records[1].result.position = 50; }],
 ['actor', f => { f.records[1].actor = 'b'; }], ['missing event', f => { f.records.splice(2, 1); }],
 ['duplicate event', f => { f.records.splice(2, 0, f.records[1]); }], ['chain', f => { f.records[3].previousHash = 'fake'; }],
 ['genesis board', f => { f.records[0].initial.board.ladders = { 1: 50 }; }],
 ['turn order', f => { f.match.turnOrder.reverse(); }], ['snapshot', f => { f.state.current.players[1].position = 50; }],
 ['cross round', f => { f.match.matchId = 'other'; }], ['request ID', f => { f.records[1].requestId = 'other'; }]
]) test(`replay rejects ${name} corruption`, () => { const f = fixture(); mutate(f); assert.throws(() => replaySnakeJournal(f.match, f.records, f.state)); });
test('finished game accepts no further rolls', () => { const f = fixture(); assert.throws(() => applySnakeJournalRoll(f.state, { actor: 'a', requestId: 'again', dice: 1, at: 2000 }), /game_already_finished/); });
test('out-of-turn and invalid die rejected; explicit turn order required', () => {
  const f = fixture(); assert.throws(() => applySnakeJournalRoll(f.initial.state, { actor: 'b', requestId: 'r', dice: 6, at: 1000 }), /not_your_turn/);
  for (const dice of [0, 7, 1.5, NaN, '6']) assert.throws(() => applySnakeJournalRoll(f.initial.state, { actor: 'a', requestId: 'r', dice, at: 1000 }), /invalid_server_die/);
  assert.throws(() => initializeSnakeJournal(f.match, board, undefined, 1000), /turn_order_not_accepted/);
});

test('server cooldown cannot be bypassed by new request IDs', () => {
  const f = fixture(); const first = applySnakeJournalRoll(f.initial.state, { actor: 'a', requestId: 'first', dice: 6, at: 2000 });
  assert.throws(() => applySnakeJournalRoll(first.state, { actor: 'a', requestId: 'second', dice: 6, at: 2001 }), /roll_cooldown/);
});

test('invalid reachable board destinations fail before initializing a paid round', () => {
  const f = fixture(); const invalid = { snakes: { 49: 80 }, ladders: {}, diceCells: {} };
  f.match.rulesHash = snakeRulesHash(invalid); assert.throws(() => initializeSnakeJournal(f.match, invalid, f.match.turnOrder, 1000), /invalid_initial_board/);
  const legacy = { snakes: { 49: 35, 99: 80 }, ladders: {}, diceCells: {} };
  f.match.rulesHash = snakeRulesHash(legacy); assert.ok(initializeSnakeJournal(f.match, legacy, f.match.turnOrder, 1000));
});

test('frozen v1 has 300 golden outcomes and matches current legitimate single-die rules', () => {
  const outcomes = [];
  for (let position = 0; position < 50; position++) for (let die = 1; die <= 6; die++) {
    const run = Engine => {
      const game = new Engine({ snakes: { 49: 35, 99: 80 }, ladders: { 3: 22, 27: { end: 46 } }, diceCells: { 10: 2 } });
      game.addPlayer('a', 'A'); game.addPlayer('b', 'B'); game.players[0].position = position; game.players[1].position = 5;
      return { position, die, result: game.rollDice([die]), players: game.players, currentTurn: game.currentTurn };
    };
    const frozen = run(FrozenGame); assert.deepEqual(frozen, run(LegacyGame)); outcomes.push(frozen);
  }
  assert.equal(journalHash(outcomes), '636c0e2a05ce809480789bc55e9b6d68984657a12d03a9a00fdcb2bb169daf05');
});
test('unknown replay rules version fails closed without rewriting old outcomes', () => {
  const f = fixture(); f.match.rulesVersion = 'snake-server-future-v2';
  assert.throws(() => replaySnakeJournal(f.match, f.records, f.state), /unsupported_rules_version/);
});

test('v1 rule hash and winner validation use frozen final tile, not mutable live helpers', async () => {
  assert.equal(snakeRulesHash(board), '3a7cfdc5bd17d8d5e4fd70041432d025c0589adf6fbe4ce438215407db55aa47');
  const f = fixture(); assert.equal(captureSnakeJournalResult(f.match, f.state).winnerAccountId, 'a');
  f.state.current.players[0].position = 51; assert.throws(() => captureSnakeJournalResult(f.match, f.state), /invalid_result_position/);
  for (const name of ['snakeDurableRules.js', 'snakeRoundCoordinator.js', 'rules/snakeV1.js']) {
    const source = await readFile(new URL(`../services/settlement/${name}`, import.meta.url), 'utf8');
    assert.equal(/from ['"][^'"]*(?:snakeServerResult|lib\/snakeRules|logic\/snakeGame)/.test(source), false);
  }
});
