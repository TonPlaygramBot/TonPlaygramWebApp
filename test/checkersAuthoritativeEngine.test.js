import { describe, expect, test } from '@jest/globals';
import {
  createInitialBoard,
  getLegalMovesForSide,
  applyAuthoritativeMove,
  SIDES
} from '../bot/utils/checkersAuthoritativeEngine.js';

function emptyBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

describe('checkers authoritative engine', () => {
  test('creates standard opening position', () => {
    const board = createInitialBoard();
    let light = 0;
    let dark = 0;
    board.forEach((row) =>
      row.forEach((cell) => {
        if (cell?.side === SIDES.LIGHT) light += 1;
        if (cell?.side === SIDES.DARK) dark += 1;
      })
    );
    expect(light).toBe(12);
    expect(dark).toBe(12);
  });

  test('enforces forced captures', () => {
    const board = emptyBoard();
    board[5][2] = { side: SIDES.LIGHT, king: false };
    board[4][3] = { side: SIDES.DARK, king: false };
    board[2][1] = { side: SIDES.LIGHT, king: false };

    const legal = getLegalMovesForSide(board, SIDES.LIGHT);
    expect(legal.every((m) => m.capture)).toBe(true);

    const rejected = applyAuthoritativeMove(
      { board, turn: SIDES.LIGHT, requiredFrom: null },
      { from: { r: 2, c: 1 }, to: { r: 1, c: 0 } }
    );
    expect(rejected.ok).toBe(false);
    expect(rejected.error).toBe('illegal_move');

    const accepted = applyAuthoritativeMove(
      { board, turn: SIDES.LIGHT, requiredFrom: null },
      { from: { r: 5, c: 2 }, to: { r: 3, c: 4 } }
    );
    expect(accepted.ok).toBe(true);
    expect(accepted.lastMove.capture).toEqual({ r: 4, c: 3 });
  });

  test('keeps same turn when chain capture remains', () => {
    const board = emptyBoard();
    board[5][0] = { side: SIDES.LIGHT, king: false };
    board[4][1] = { side: SIDES.DARK, king: false };
    board[2][3] = { side: SIDES.DARK, king: false };

    const first = applyAuthoritativeMove(
      { board, turn: SIDES.LIGHT, requiredFrom: null },
      { from: { r: 5, c: 0 }, to: { r: 3, c: 2 } }
    );
    expect(first.ok).toBe(true);
    expect(first.chainCapture).toBe(true);
    expect(first.turn).toBe(SIDES.LIGHT);
    expect(first.requiredFrom).toEqual({ r: 3, c: 2 });

    const wrongPiece = applyAuthoritativeMove(
      {
        board: first.board,
        turn: first.turn,
        requiredFrom: first.requiredFrom
      },
      { from: { r: 3, c: 2 }, to: { r: 4, c: 3 } }
    );
    expect(wrongPiece.ok).toBe(false);
  });

  test('declares winner when opponent has no legal moves', () => {
    const board = emptyBoard();
    board[0][1] = { side: SIDES.LIGHT, king: true };
    board[1][2] = { side: SIDES.DARK, king: false };

    const result = applyAuthoritativeMove(
      { board, turn: SIDES.LIGHT, requiredFrom: null },
      { from: { r: 0, c: 1 }, to: { r: 2, c: 3 } }
    );

    expect(result.ok).toBe(true);
    expect(result.winner).toBe(SIDES.LIGHT);
    expect(result.reason).toBe('all_dark_captured');
  });
});
