import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WHITE,
  BLACK,
  getSingleDieMoves,
  applyMove,
  collectTurnSequences
} from '../webapp/src/utils/tavullEngine.js';
import {
  createMatch,
  openingRoll,
  rollTurn,
  playMove,
  endTurn,
  legalFirstMoves,
  canDouble,
  offerDouble,
  answerDouble,
  nextGame,
  gameResult,
  pipCount
} from '../webapp/src/games/backgammon/match.mjs';
const empty = () => ({
  points: Array.from({ length: 24 }, () => ({ color: null, count: 0 })),
  bar: { white: 0, black: 0 },
  off: { white: 0, black: 0 }
});
const point = (board, i, color, count = 1) => {
  board.points[i] = { color, count };
};
const moving = (board, rolls, turn = WHITE) =>
  rollTurn({ ...createMatch(), board, turn, phase: 'roll' }, rolls);

test('standard start has 15 checkers and 167 pips per side', () => {
  const board = createMatch().board;
  for (const side of [WHITE, BLACK]) {
    assert.equal(
      board.points.reduce((n, p) => n + (p.color === side ? p.count : 0), 0),
      15
    );
    assert.equal(pipCount(board, side), 167);
  }
});
test('opening ties reroll; higher die starts using the two opening numbers', () => {
  let match = openingRoll(createMatch(), [3, 3]);
  assert.equal(match.phase, 'opening');
  assert.equal(match.cube.value, 1);
  match = openingRoll(match, [2, 5]);
  assert.equal(match.turn, BLACK);
  assert.deepEqual(match.dice, [2, 5]);
  assert.equal(canDouble(match), false);
  assert.throws(() => rollTurn(match, [6, 6]));
});
test('must play the higher die when either die alone works', () => {
  const board = empty();
  point(board, 0, WHITE);
  board.off.white = 14;
  const options = legalFirstMoves(moving(board, [1, 6]));
  assert.deepEqual(options, [{ from: 0, to: 'off', die: 6 }]);
});
test('using two dice wins over playing a higher die first', () => {
  const board = empty();
  board.bar.white = 1;
  point(board, 17, BLACK, 2);
  point(board, 16, BLACK, 2);
  // 1 enters on 24, then 6 reaches 18 (blocked); 6 enters on 19, then 1 reaches 18 (blocked).
  let match = moving(board, [1, 6]);
  assert.ok(legalFirstMoves(match).every((m) => m.die === 6));
  board.points[17] = { color: null, count: 0 };
  point(board, 22, BLACK, 2);
  match = moving(board, [1, 6]);
  assert.ok(match.sequences.every((s) => s.line.length === 2));
});
test('blocked bar cannot be bypassed, partial entry forfeits only impossible dice', () => {
  const board = empty();
  board.bar.white = 2;
  point(board, 18, BLACK, 2);
  point(board, 5, WHITE, 13);
  const match = moving(board, [1, 6]);
  assert.deepEqual(legalFirstMoves(match), [{ from: 'bar', to: 23, die: 1 }]);
  const after = playMove(match, legalFirstMoves(match)[0]);
  assert.equal(after.board.bar.white, 1);
  assert.equal(after.sequences.length, 0);
  assert.equal(endTurn(after).turn, BLACK);
  assert.throws(() => applyMove(board, WHITE, { from: 5, to: 4, die: 1 }));
});
test('complete blockade passes; moving to two opponents is illegal', () => {
  const board = empty();
  board.bar.white = 1;
  for (let i = 18; i < 24; i++) point(board, i, BLACK, 2);
  const match = moving(board, [2, 4]);
  assert.equal(match.sequences.length, 0);
  assert.equal(endTurn(match).turn, BLACK);
  assert.throws(() => applyMove(board, WHITE, { from: 'bar', to: 22, die: 2 }));
});
test('doubles grant four moves and retain exactly the legal suffix after every choice', () => {
  let match = openingRoll(createMatch(), [6, 1]);
  while (match.sequences.length)
    match = playMove(match, legalFirstMoves(match)[0]);
  match = rollTurn(endTurn(match), [2, 2]);
  assert.equal(match.dice.length, 4);
  for (let remaining = 3; remaining >= 0; remaining--) {
    match = playMove(match, legalFirstMoves(match)[0]);
    assert.equal(match.dice.length, remaining);
  }
  assert.equal(match.sequences.length, 0);
  assert.throws(() => playMove(match, { from: 0, to: 2, die: 2 }));
});
test('individual choices preserve other checkers until selected and reject premature pass', () => {
  const match = openingRoll(createMatch(), [4, 1]);
  assert.throws(() => endTurn(match));
  const first = legalFirstMoves(match)[0];
  const after = playMove(match, first);
  assert.deepEqual(after.board, applyMove(match.board, WHITE, first));
  assert.equal(after.dice.length, 1);
  assert.equal(after.phase, 'move');
});
test('bearing off exact, oversized highest checker, and hit during bear-off for both directions', () => {
  for (const side of [WHITE, BLACK]) {
    const board = empty(),
      at = (distance) => (side === WHITE ? distance - 1 : 24 - distance);
    point(board, at(5), side);
    point(board, at(2), side, 14);
    assert.ok(getSingleDieMoves(board, side, 2).some((m) => m.to === 'off'));
    assert.ok(
      getSingleDieMoves(board, side, 6)
        .filter((m) => m.to === 'off')
        .every((m) => m.from === at(5))
    );
    board.bar[side] = 1;
    assert.ok(getSingleDieMoves(board, side, 6).every((m) => m.from === 'bar'));
  }
});
test('single, gammon and backgammon score correctly for both winners', () => {
  for (const winner of [WHITE, BLACK]) {
    const loser = winner === WHITE ? BLACK : WHITE,
      board = empty();
    board.off[winner] = 15;
    board.off[loser] = 1;
    assert.equal(gameResult(board, winner, 4).points, 4);
    board.off[loser] = 0;
    point(board, 10, loser, 15);
    assert.equal(gameResult(board, winner, 4).points, 8);
    board.bar[loser] = 1;
    assert.equal(gameResult(board, winner, 4).points, 12);
    board.bar[loser] = 0;
    point(board, winner === WHITE ? 0 : 23, loser);
    assert.equal(gameResult(board, winner).kind, 'backgammon');
  }
});
test('cube ownership, redoubles, and drop use the old value', () => {
  let match = { ...createMatch(), turn: WHITE, phase: 'roll' };
  match = offerDouble(match);
  assert.throws(() => answerDouble(match, WHITE, true));
  assert.throws(() => rollTurn(match, [2, 1]));
  match = answerDouble(match, BLACK, true);
  assert.equal(match.cube.owner, BLACK);
  assert.equal(match.cube.value, 2);
  assert.equal(canDouble(match, WHITE), false);
  match = offerDouble({ ...match, turn: BLACK });
  match = answerDouble(match, WHITE, false);
  assert.equal(match.result.points, 2);
  assert.equal(match.score.black, 2);
  assert.equal(match.phase, 'over');
});
test('Crawford applies once when first one away; cube returns afterwards', () => {
  let match = {
    ...createMatch(5),
    phase: 'over',
    score: { white: 4, black: 1 }
  };
  match = nextGame(match);
  assert.equal(match.crawford, true);
  assert.equal(canDouble({ ...match, phase: 'roll', turn: BLACK }), false);
  match = nextGame({ ...match, phase: 'over', score: { white: 4, black: 2 } });
  assert.equal(match.crawford, false);
  assert.equal(canDouble({ ...match, phase: 'roll', turn: BLACK }), true);
  assert.throws(() =>
    nextGame({ ...match, phase: 'over', score: { white: 5, black: 2 } })
  );
});
test('last checker ends and scores the game before any opponent action', () => {
  const board = empty();
  point(board, 0, WHITE);
  board.off.white = 14;
  point(board, 10, BLACK, 15);
  const match = moving(board, [1, 6]);
  const done = playMove(match, legalFirstMoves(match)[0]);
  assert.equal(done.phase, 'over');
  assert.equal(done.result.kind, 'gammon');
  assert.equal(done.score.white, 2);
  assert.throws(() => endTurn(done));
  assert.throws(() => rollTurn(done, [1, 2]));
});
test('legal turn simulation conserves all 30 pieces and reaches wins', () => {
  let rng = 112;
  const die = () => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return (rng % 6) + 1;
  };
  for (let game = 0; game < 8; game++) {
    let match = createMatch();
    let turns = 0;
    while (match.phase !== 'over' && turns++ < 600) {
      if (match.phase === 'opening') match = openingRoll(match, [die(), die()]);
      else if (match.phase === 'roll') match = rollTurn(match, [die(), die()]);
      else {
        while (match.phase === 'move' && match.sequences.length) {
          const moves = legalFirstMoves(match);
          match = playMove(match, moves[(die() - 1) % moves.length]);
          for (const side of [WHITE, BLACK])
            assert.equal(
              match.board.points.reduce(
                (sum, p) => sum + (p.color === side ? p.count : 0),
                0
              ) +
                match.board.bar[side] +
                match.board.off[side],
              15
            );
          assert.ok(
            match.board.points.every(
              (p) => p.count >= 0 && (p.count === 0) === (p.color === null)
            )
          );
        }
        if (match.phase !== 'over') match = endTurn(match);
      }
    }
    assert.equal(
      match.phase,
      'over',
      `game ${game} stalled after ${turns} turns`
    );
  }
});
