import test from 'node:test';
import assert from 'node:assert/strict';
import {
  START_FEN,
  parseFEN,
  boardToFEN,
  generateMoves,
  applyMove,
  revertMove,
  isSquareAttacked,
  getGameOutcome,
  positionKey,
  getBoardState,
  cloneBoard
} from '../webapp/src/games/chess/chessRules.mjs';
import {
  validateAndApplyChessMove,
  adjudicateChessTimeout
} from '../bot/chessRules.js';
const legal = (board, from, to, promotion = null) =>
  generateMoves(board, getBoardState(board).turnWhite).find(
    (m) =>
      m.fromR === from[0] &&
      m.fromC === from[1] &&
      m.toR === to[0] &&
      m.toC === to[1] &&
      m.promotion === promotion
  );
function play(board, from, to, promotion = null) {
  const m = legal(board, from, to, promotion);
  assert.ok(m, `${from} -> ${to}`);
  return applyMove(board, ...from, ...to, promotion || 'Q');
}
function perft(board, depth) {
  if (!depth) return 1;
  let n = 0;
  for (const m of generateMoves(board, getBoardState(board).turnWhite)) {
    const s = applyMove(
      board,
      m.fromR,
      m.fromC,
      m.toR,
      m.toC,
      m.promotion || 'Q'
    );
    n += perft(board, depth - 1);
    revertMove(board, m.fromR, m.fromC, m.toR, m.toC, s);
  }
  return n;
}
test('standard starting position perft through depth four; make/unmake preserves FEN', () => {
  const b = parseFEN(START_FEN);
  for (const [d, n] of [
    [1, 20],
    [2, 400],
    [3, 8902],
    [4, 197281]
  ])
    assert.equal(perft(b, d), n);
  assert.equal(boardToFEN(b), START_FEN);
});
test('Kiwipete perft includes castling and pinned pieces', () => {
  const b = parseFEN(
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'
  );
  assert.equal(perft(b, 1), 48);
  assert.equal(perft(b, 2), 2039);
  assert.equal(perft(b, 3), 97862);
});
test('rook/pawn endgame perft exercises en passant and check evasions', () => {
  const b = parseFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
  assert.equal(perft(b, 3), 2812);
});
test('pawns attack empty diagonals, never their forward push; attacked transit prevents castle', () => {
  const b = parseFEN('4k3/8/8/8/8/8/6p1/4K2R w K - 0 1');
  assert.equal(isSquareAttacked(b, 7, 5, false), true);
  assert.equal(isSquareAttacked(b, 7, 6, false), false);
  assert.equal(legal(b, [7, 4], [7, 6]), undefined);
});
test('en passant exists for one reply, removes correct pawn and rolls back exactly', () => {
  const b = parseFEN('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1');
  play(b, [1, 3], [3, 3]);
  const before = boardToFEN(b),
    snapshot = play(b, [3, 4], [2, 3]);
  assert.equal(b[3][3], null);
  assert.equal(b[2][3].t, 'P');
  revertMove(b, 3, 4, 2, 3, snapshot);
  assert.equal(boardToFEN(b), before);
  play(b, [7, 4], [7, 5]);
  play(b, [0, 4], [0, 5]);
  assert.equal(legal(b, [3, 4], [2, 3]), undefined);
});
test('en passant cannot expose own king to a rook', () => {
  const b = parseFEN('4k3/8/8/r4pPK/8/8/8/8 w - f6 0 1');
  assert.equal(legal(b, [3, 6], [2, 5]), undefined);
});
test('both castling sides move rook and king, restore flags on unmake, and never restore lost rights', () => {
  for (const c of [2, 6]) {
    const b = parseFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const fen = boardToFEN(b);
    const snap = play(b, [7, 4], [7, c]);
    assert.equal(b[7][c === 6 ? 5 : 3].t, 'R');
    revertMove(b, 7, 4, 7, c, snap);
    assert.equal(boardToFEN(b), fen);
  }
  const b = parseFEN('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  play(b, [7, 7], [6, 7]);
  play(b, [0, 4], [0, 5]);
  play(b, [6, 7], [7, 7]);
  play(b, [0, 5], [0, 4]);
  assert.equal(legal(b, [7, 4], [7, 6]), undefined);
});
test('all four promotion choices are legal and kings cannot be captured', () => {
  const b = parseFEN('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  assert.deepEqual(
    generateMoves(b, true, { fromR: 1, fromC: 0 }).map((m) => m.promotion),
    ['Q', 'R', 'B', 'N']
  );
  const s = play(b, [1, 0], [0, 0], 'N');
  assert.equal(b[0][0].t, 'N');
  revertMove(b, 1, 0, 0, 0, s);
  assert.equal(b[1][0].t, 'P');
  const invalid = parseFEN('4k3/4R3/8/8/8/8/8/4K3 w - - 0 1');
  assert.equal(legal(invalid, [1, 4], [0, 4]), undefined);
});
test('mate, stalemate, dead material, claimable and automatic draws', () => {
  assert.equal(
    getGameOutcome(parseFEN('7k/6Q1/5K2/8/8/8/8/8 b - - 150 80'), false).winner,
    'white'
  );
  assert.equal(
    getGameOutcome(parseFEN('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1'), false).draw,
    'stalemate'
  );
  assert.equal(
    getGameOutcome(parseFEN('7k/8/8/8/8/8/8/KB6 w - - 0 1'), true).draw,
    'insufficient_material'
  );
  const b = parseFEN('4k3/8/8/8/8/8/8/R3K3 w - - 100 51');
  assert.equal(getGameOutcome(b, true).draw, null);
  assert.equal(getGameOutcome(b, true, 1, true).draw, 'fifty_moves');
  assert.equal(getGameOutcome(b, true, 3, true).draw, 'threefold_repetition');
  assert.equal(getGameOutcome(b, true, 5).draw, 'fivefold_repetition');
  assert.equal(
    getGameOutcome(parseFEN(boardToFEN(b).replace('100 51', '150 76')), true)
      .draw,
    'seventy_five_moves'
  );
});
test('repetition keys distinguish castling and legal en passant but ignore unusable targets', () => {
  const a = parseFEN(START_FEN),
    b = parseFEN(START_FEN.replace('KQkq', '-'));
  assert.notEqual(positionKey(a), positionKey(b));
  play(a, [6, 4], [4, 4]);
  const c = cloneBoard(a);
  c.chessState.enPassant = null;
  assert.equal(positionKey(a), positionKey(c));
  const d = parseFEN('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1'),
    e = cloneBoard(d);
  e.chessState.enPassant = null;
  assert.notEqual(positionKey(d), positionKey(e));
});
const stateFor = (fen) => ({
  board: parseFEN(fen),
  fen,
  turnWhite: getBoardState(parseFEN(fen)).turnWhite,
  players: [
    { id: 'w', side: 'white' },
    { id: 'b', side: 'black' }
  ],
  moveSeq: 0
});
test('server rejects forged board, coordinates, wrong seats, wrong turns and moves after a draw', () => {
  const state = stateFor(START_FEN),
    move = {
      lastMove: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } },
      board: [],
      winner: 'white'
    };
  assert.equal(
    validateAndApplyChessMove(state, 'spectator', move).error,
    'seat_required'
  );
  assert.equal(
    validateAndApplyChessMove(state, 'b', move).error,
    'wrong_player_turn'
  );
  assert.equal(
    validateAndApplyChessMove({ ...state, draw: 'stalemate' }, 'w', move).error,
    'game_finished'
  );
  assert.equal(
    validateAndApplyChessMove(state, 'w', {
      lastMove: { from: { r: null, c: 0 }, to: { r: 0, c: 0 } }
    }).error,
    'invalid_coordinates'
  );
  const result = validateAndApplyChessMove(state, 'w', move);
  assert.equal(result.ok, true);
  assert.equal(result.state.winner, null);
  assert.equal(result.state.board[4][4].t, 'P');
  assert.equal(result.state.rules.enPassant[0], 5);
});
test('server preserves en passant through JSON snapshots and accepts underpromotion', () => {
  let state = stateFor('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1');
  let result = validateAndApplyChessMove(state, 'b', {
    lastMove: { from: { r: 1, c: 3 }, to: { r: 3, c: 3 } }
  });
  assert.ok(result.ok);
  state = JSON.parse(JSON.stringify({ ...state, ...result.state }));
  result = validateAndApplyChessMove(state, 'w', {
    lastMove: { from: { r: 3, c: 4 }, to: { r: 2, c: 3 } }
  });
  assert.ok(result.ok);
  assert.equal(result.state.board[3][3], null);
  result = validateAndApplyChessMove(
    stateFor('4k3/P7/8/8/8/8/8/4K3 w - - 0 1'),
    'w',
    { lastMove: { from: { r: 1, c: 0 }, to: { r: 0, c: 0 }, promotion: 'N' } }
  );
  assert.ok(result.ok);
  assert.equal(result.state.board[0][0].t, 'N');
});

test('authoritative clock ignores early checks, rejects expired moves and draws when mate is impossible', () => {
  const state = { ...stateFor(START_FEN), turnDeadline: 1000 };
  assert.equal(adjudicateChessTimeout(state, 999), null);
  assert.equal(adjudicateChessTimeout(state, 1000).winner, 'black');
  assert.equal(
    adjudicateChessTimeout({ ...state, winner: 'white' }, 2000),
    null
  );
  const dead = {
    ...stateFor('4k3/8/8/8/8/8/8/4K3 w - - 0 1'),
    turnDeadline: 1000
  };
  assert.equal(
    adjudicateChessTimeout(dead, 1000).draw,
    'insufficient_material'
  );
  assert.equal(
    validateAndApplyChessMove(state, 'w', {
      lastMove: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } }
    }).error,
    'turn_expired'
  );
});
test('server draw claims are turn-owned and repeated-position counts survive moves', () => {
  const fen = '4k3/8/8/8/8/8/8/R3K3 w - - 100 51',
    state = stateFor(fen);
  assert.equal(
    validateAndApplyChessMove(state, 'b', { claimDraw: true }).error,
    'wrong_player_turn'
  );
  assert.equal(
    validateAndApplyChessMove(state, 'w', { claimDraw: true }).state.draw,
    'fifty_moves'
  );
  assert.equal(
    validateAndApplyChessMove(stateFor(START_FEN), 'w', { claimDraw: true })
      .error,
    'draw_not_claimable'
  );
  let repeated = stateFor(START_FEN);
  const cycle = [
    ['w', [7, 6], [5, 5]],
    ['b', [0, 6], [2, 5]],
    ['w', [5, 5], [7, 6]],
    ['b', [2, 5], [0, 6]]
  ];
  for (let i = 0; i < 4; i++)
    for (const [id, from, to] of cycle) {
      const result = validateAndApplyChessMove(repeated, id, {
        lastMove: {
          from: { r: from[0], c: from[1] },
          to: { r: to[0], c: to[1] }
        }
      });
      assert.ok(result.ok);
      repeated = { ...repeated, ...result.state };
    }
  assert.equal(repeated.draw, 'fivefold_repetition');
});
