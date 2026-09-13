import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  createInitialBoard, cloneBoard, normalizeBoard, getLegalMovesForSide,
  getPieceMoves, applyAuthoritativeMove, positionKey
} from '../shared/checkersRules.js';
import { searchBestMove, getMovesForSide, applyMoveToBoard } from '../webapp/src/pages/Games/shared/checkersAi.js';
import { createCheckersReplay, isCheckersTap, nextCheckersAnimationStart } from '../webapp/src/pages/Games/shared/checkersPresentation.js';
import { createCheckersRealtimeStore } from '../bot/utils/checkersRealtimeState.js';
import { CheckersGame } from '../bot/logic/checkersGame.js';
import { buildCheckersSettlement } from '../bot/utils/checkersSettlement.js';

const empty = () => Array.from({ length: 8 }, () => Array(8).fill(null));
const piece = (side, king = false) => ({ side, king });
const move = (from, to) => ({ from: { r: from[0], c: from[1] }, to: { r: to[0], c: to[1] } });

test('opening has 12 men per side on dark squares and seven light opening moves', () => {
  const board = createInitialBoard();
  assert.equal(board.flat().filter(p => p?.side === 'light').length, 12);
  assert.equal(board.flat().filter(p => p?.side === 'dark').length, 12);
  assert.deepEqual(normalizeBoard(board), board);
  assert.equal(getLegalMovesForSide(board, 'light').length, 7);
});

for (const side of ['light', 'dark']) {
  const flip = ([r, c]) => side === 'light' ? [r, c] : [7 - r, 7 - c];
  const enemy = side === 'light' ? 'dark' : 'light';
  test(`${side}: men cannot move or capture backwards`, () => {
    const board = empty();
    const [r, c] = flip([3, 2]); board[r][c] = piece(side);
    const [er, ec] = flip([4, 3]); board[er][ec] = piece(enemy);
    assert.equal(applyAuthoritativeMove({ board, turn: side }, move(flip([3, 2]), flip([5, 4]))).ok, false);
    assert.equal(applyAuthoritativeMove({ board, turn: side }, move(flip([3, 2]), flip([4, 1]))).ok, false);
  });
  test(`${side}: promotion ends a capture despite a backward king jump`, () => {
    const board = empty();
    for (const [coords, p] of [[[2, 1], piece(side)], [[1, 2], piece(enemy)], [[1, 4], piece(enemy)]]) {
      const [r, c] = flip(coords); board[r][c] = p;
    }
    const result = applyAuthoritativeMove({ board, turn: side }, move(flip([2, 1]), flip([0, 3])));
    assert.equal(result.ok, true);
    assert.equal(result.promoted, true);
    assert.equal(result.turn, enemy);
    assert.equal(result.requiredFrom, null);
    assert.equal(result.chainCapture, false);
    assert.equal(getPieceMoves(result.board, result.lastMove.to).filter(m => m.capture).length, 1);
  });
  test(`${side}: quiet promotion crowns and passes the turn`, () => {
    const board = empty();
    const [r, c] = flip([1, 2]); board[r][c] = piece(side);
    const [er, ec] = flip([5, 6]); board[er][ec] = piece(enemy);
    const result = applyAuthoritativeMove({ board, turn: side }, move(flip([1, 2]), flip([0, 1])));
    assert.equal(result.promoted, true);
    assert.equal(result.turn, enemy);
  });
}

test('global compulsory captures override an otherwise legal quiet move', () => {
  const board = empty(); board[5][0] = piece('light'); board[4][1] = piece('dark'); board[5][6] = piece('light');
  const moves = getLegalMovesForSide(board, 'light');
  assert.equal(moves.length, 1); assert.ok(moves[0].capture);
  assert.equal(applyAuthoritativeMove({ board, turn: 'light' }, move([5, 6], [4, 5])).error, 'illegal_move');
});

test('capture chain cannot switch to another capturing piece', () => {
  const board = empty();
  board[5][0] = piece('light'); board[4][1] = piece('dark'); board[2][3] = piece('dark');
  board[5][6] = piece('light'); board[4][5] = piece('dark');
  const first = applyAuthoritativeMove({ board, turn: 'light' }, move([5, 0], [3, 2]));
  assert.deepEqual(first.requiredFrom, { r: 3, c: 2 });
  assert.equal(applyAuthoritativeMove(first, move([5, 6], [3, 4])).error, 'chain_capture_required_piece');
  assert.ok(getMovesForSide(first.board, 'light', first.requiredFrom).every(m => m.from.r === 3 && m.from.c === 2));
  assert.equal(applyAuthoritativeMove(first, move([3, 2], [1, 4])).turn, 'dark');
});

test('choice of captures is free; the longest path is not compulsory', () => {
  const board = empty();
  board[5][2] = piece('light'); board[4][1] = piece('dark'); board[4][3] = piece('dark'); board[2][5] = piece('dark');
  assert.equal(getLegalMovesForSide(board, 'light').length, 2);
  const shorter = applyAuthoritativeMove({ board, turn: 'light' }, move([5, 2], [3, 0]));
  assert.equal(shorter.ok, true); assert.equal(shorter.turn, 'dark');
});

test('kings capture backwards but are not flying kings', () => {
  const board = empty(); board[2][1] = piece('light', true); board[3][2] = piece('dark');
  assert.equal(applyAuthoritativeMove({ board, turn: 'light' }, move([2, 1], [4, 3])).ok, true);
  assert.equal(applyAuthoritativeMove({ board, turn: 'light' }, move([2, 1], [5, 4])).ok, false);
});

test('capture wins and terminal positions reject subsequent input', () => {
  const board = empty(); board[3][2] = piece('dark'); board[4][3] = piece('light');
  const end = applyAuthoritativeMove({ board, turn: 'dark' }, move([3, 2], [5, 4]));
  assert.equal(end.winner, 'dark');
  assert.equal(applyAuthoritativeMove(end, move([5, 4], [6, 5])).error, 'game_finished');
});

test('a blocked opponent loses even with pieces remaining', () => {
  const board = empty(); board[7][0] = piece('dark'); board[3][4] = piece('light');
  const end = applyAuthoritativeMove({ board, turn: 'light' }, move([3, 4], [2, 3]));
  assert.equal(end.winner, 'light'); assert.equal(end.reason, 'no_legal_moves');
});

test('invalid coordinates, boards and chain origins reject without mutating state', () => {
  const board = createInitialBoard(), before = cloneBoard(board);
  for (const to of [[8, 0], [-1, 0], [4.2, 1], [NaN, 0]]) {
    assert.equal(applyAuthoritativeMove({ board, turn: 'light' }, move([5, 0], to)).ok, false);
  }
  assert.equal(applyAuthoritativeMove({ board: [], turn: 'light' }, move([5, 0], [4, 1])).error, 'invalid_board');
  assert.equal(applyAuthoritativeMove({ board, requiredFrom: { r: 9, c: 2 } }, move([5, 0], [4, 1])).ok, false);
  assert.deepEqual(board, before);
});

test('third repeated position is an automatic draw, including the side to move', () => {
  const board = empty(); board[7][0] = piece('light', true); board[0][7] = piece('dark', true);
  let state = { board, turn: 'light' };
  const cycle = [[[7, 0], [6, 1]], [[0, 7], [1, 6]], [[6, 1], [7, 0]], [[1, 6], [0, 7]]];
  for (let i = 0; i < 8; i++) {
    state = applyAuthoritativeMove(state, move(...cycle[i % 4]));
    assert.equal(state.ok, true); assert.equal(state.draw, i === 7);
  }
  assert.equal(state.reason, 'threefold_repetition');
  assert.notEqual(positionKey(board, 'light'), positionKey(board, 'dark'));
  assert.equal(applyAuthoritativeMove(state, move([7, 0], [6, 1])).error, 'game_finished');
});

test('40 moves per player means 80 quiet king plies, not 40 plies', () => {
  const board = empty(); board[7][0] = piece('light', true); board[0][7] = piece('dark', true);
  const payload = move([7, 0], [6, 1]);
  assert.equal(applyAuthoritativeMove({ board, turn: 'light', quietPlies: 39 }, payload).draw, false);
  const end = applyAuthoritativeMove({ board, turn: 'light', quietPlies: 79 }, payload);
  assert.equal(end.draw, true); assert.equal(end.reason, 'forty_move_rule');
});

test('captures and man advances reset the no-progress counter', () => {
  const board = empty(); board[5][0] = piece('light'); board[0][7] = piece('dark', true);
  assert.equal(applyAuthoritativeMove({ board, turn: 'light', quietPlies: 79 }, move([5, 0], [4, 1])).quietPlies, 0);
  board[5][0].king = true; board[4][1] = piece('dark');
  assert.equal(applyAuthoritativeMove({ board, turn: 'light', quietPlies: 79 }, move([5, 0], [3, 2])).quietPlies, 0);
});

test('AI values an opponent with no moves as a win and its own blockade as a loss', () => {
  const board = empty(); board[0][1] = piece('light'); board[7][0] = piece('dark');
  assert.ok(searchBestMove(board, 'light', 2).score > 0);
  assert.ok(searchBestMove(board, 'dark', 2).score < 0);
});

test('AI searches only the required continuation, for either side', () => {
  for (const side of ['light', 'dark']) {
    const board = empty(); board[3][2] = piece(side, true); board[4][3] = piece(side === 'light' ? 'dark' : 'light');
    board[3][6] = piece(side, true); board[4][5] = piece(side === 'light' ? 'dark' : 'light');
    const best = searchBestMove(board, side, 2, -Infinity, Infinity, { r: 3, c: 2 }).move;
    assert.deepEqual(best.from, { r: 3, c: 2 });
  }
});

test('display adapter and server produce identical results for 12 complete AI matches', () => {
  const started = performance.now();
  let completed = 0, jumps = 0;
  for (let game = 0; game < 12; game++) {
    let state = { board: createInitialBoard(), turn: 'light' };
    for (let ply = 0; ply < 500 && !state.winner && !state.draw; ply++) {
      const legal = getMovesForSide(state.board, state.turn, state.requiredFrom);
      const chosen = ply < 2 ? legal[(game + ply) % legal.length]
        : searchBestMove(state.board, state.turn, 2, -Infinity, Infinity, state.requiredFrom).move;
      assert.ok(chosen, 'nonterminal game must have a move');
      const client = applyMoveToBoard(state.board, chosen, { ...state, trackDraws: true });
      const server = applyAuthoritativeMove(state, move([chosen.from.r, chosen.from.c], [chosen.r, chosen.c]));
      assert.equal(server.ok, true);
      assert.deepEqual(client.board, server.board);
      assert.equal(client.turn, server.turn);
      assert.deepEqual(client.requiredFrom, server.requiredFrom);
      assert.equal(client.draw, server.draw);
      assert.equal(client.winner, server.winner);
      assert.ok(normalizeBoard(server.board));
      if (server.lastMove.capture) jumps++;
      state = server;
    }
    assert.ok(state.winner || state.draw, 'match must terminate'); completed++;
  }
  console.log(`AI verification: ${completed} completed matches, ${jumps} captures, ${Math.round(performance.now() - started)}ms (container, not a phone benchmark).`);
});

test('replay never mutates live state and cancel prevents stale restoration', () => {
  let callback, renders = 0;
  const replay = createCheckersReplay(fn => { callback = fn; return 1; }, () => {});
  const before = createInitialBoard(); const live = applyAuthoritativeMove({ board: before, turn: 'light' }, move([5, 0], [4, 1]));
  const snapshot = JSON.stringify(live);
  replay.play(before, () => renders++);
  assert.equal(replay.getBoard(live.board), before);
  replay.cancel(); callback();
  assert.equal(replay.getBoard(live.board), live.board);
  assert.equal(JSON.stringify(live), snapshot); assert.equal(renders, 1);
  replay.play(before, () => renders++); callback();
  assert.equal(replay.isActive(), false); assert.equal(renders, 3);
});

test('finger jitter is a tap; drags, cancelled look gestures and long holds are not', () => {
  const start = { x: 100, y: 100, at: 0 };
  assert.equal(isCheckersTap(start, { x: 104, y: 102, at: 200 }), true);
  assert.equal(isCheckersTap(start, { x: 125, y: 100, at: 200 }), false);
  assert.equal(isCheckersTap({ ...start, lookDragged: true }, { x: 100, y: 100, at: 200 }), false);
  assert.equal(isCheckersTap(start, { x: 100, y: 100, at: 900 }), false);
});

test('jump animations queue sequentially and ignore smoke timing', () => {
  assert.equal(nextCheckersAnimationStart([], 100), 100);
  assert.equal(nextCheckersAnimationStart([{ type: 'move', startedAt: 100, duration: 430 }, { type: 'smoke', startedAt: 500, duration: 1000 }], 200), 530);
  assert.equal(nextCheckersAnimationStart([{ type: 'move', startedAt: 100, duration: 430 }], 600), 600);
});

test('online store carries draw history and continuation through reconnect', () => {
  const store = createCheckersRealtimeStore();
  const result = applyAuthoritativeMove(store.getState('table'), move([5, 0], [4, 1]));
  store.setState('table', result);
  const restored = store.getState('table');
  assert.deepEqual(restored.positionCounts, result.positionCounts);
  store.setState('table', { requiredFrom: { r: 8, c: 1 } });
  assert.equal(store.getState('table').requiredFrom, null);
});

test('legacy route enforces turns, bounds, captures and completion', () => {
  const game = new CheckersGame(); game.addPlayer('a', 'A'); game.addPlayer('a', 'A'); game.addPlayer('b', 'B');
  assert.equal(game.players.length, 2);
  assert.equal(game.movePiece(1, { row: 5, col: 0 }, { row: 4, col: 1 }), false);
  assert.equal(game.movePiece(0, { row: 2, col: 1 }, { row: 8, col: 1 }), false);
  game.board = empty(); game.board[3][2] = { player: 0 }; game.board[4][3] = { player: 1 };
  assert.equal(game.movePiece(0, { row: 3, col: 2 }, { row: 5, col: 4 }), true);
  assert.equal(game.finished, true);
});

test('win payout and draw refunds are guarded atomically per account on retry', () => {
  const input = { tableId: 't', winnerId: 'a', loserId: 'b', playerIds: ['a', 'b'], stake: 10, reason: 'test' };
  for (const draw of [false, true]) {
    const plan = buildCheckersSettlement({ ...input, draw });
    const accounts = new Map([['a', { balance: 0, ids: new Set() }], ['b', { balance: 0, ids: new Set() }]]);
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const { updateOne: { filter, update } } of plan.operations) {
        const user = accounts.get(filter.accountId);
        assert.equal(filter['transactions.transactionId'].$ne, update.$push.transactions.transactionId);
        if (user.ids.has(filter['transactions.transactionId'].$ne)) continue;
        user.balance += update.$inc?.balance || 0;
        user.ids.add(update.$push.transactions.transactionId);
      }
    }
    assert.equal(accounts.get('a').balance, draw ? 10 : 20);
    assert.equal(accounts.get('b').balance, draw ? 10 : 0);
  }
  assert.equal(buildCheckersSettlement({ ...input, stake: 0 }), null);
  assert.throws(() => buildCheckersSettlement({ ...input, draw: true, playerIds: ['a', 'a'] }), /missing_players/);
});
