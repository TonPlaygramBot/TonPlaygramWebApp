import { describe, expect, it } from 'vitest';
import { createBoard, cloneBoard, getDropRow, getWinningCells, chooseAiMove, isFull, mapFourInRowSnapshot } from './fourInRowGame.js';

describe('Four in Row rules', () => {
  it.each([[6, 7], [7, 8]])('uses gravity and rejects full or invalid columns on %ix%i', (rows, cols) => {
    const board = createBoard(rows, cols);
    for (let r = rows - 1; r >= 0; r--) {
      expect(getDropRow(board, 0)).toBe(r);
      board[r][0] = r % 2;
    }
    for (const col of [0, -1, cols, 0.5, NaN, null, '1']) expect(getDropRow(board, col)).toBe(-1);
    expect(getDropRow(board, cols - 1)).toBe(rows - 1);
  });
  it.each([[0, 1, 5, 0], [1, 0, 0, 6], [1, 1, 0, 0], [-1, 1, 5, 0]])('detects four in direction %i,%i', (dr, dc, r, c) => {
    const board = createBoard(6, 7);
    const cells = Array.from({ length: 4 }, (_, i) => [r + dr * i, c + dc * i]);
    for (const [y, x] of cells.slice(0, 3)) board[y][x] = 0;
    expect(getWinningCells(board, 0)).toBeNull();
    board[cells[3][0]][cells[3][1]] = 0;
    expect(getWinningCells(board, 0)).toHaveLength(4);
    expect(getWinningCells(board, null)).toBeNull();
  });
  it('recognizes a full draw with zero-valued online tokens', () => {
    const board = Array.from({ length: 6 }, (_, r) => Array.from({ length: 7 }, (_, c) => (Math.floor(c / 2) + r) % 2));
    expect(isFull(board)).toBe(true);
    expect(getWinningCells(board, 0)).toBeNull();
    expect(getWinningCells(board, 1)).toBeNull();
  });
  it('takes a win before blocking and blocks an immediate loss', () => {
    const board = createBoard(6, 7);
    for (let r = 3; r < 6; r++) board[r][0] = 'player';
    expect(chooseAiMove(board, 'ai', 'player', 3)).toBe(0);
    for (let r = 3; r < 6; r++) board[r][6] = 'ai';
    expect(chooseAiMove(board, 'ai', 'player', 3)).toBe(6);
  });
  it.each([[6, 7], [7, 8]])('completes six legal AI rounds on %ix%i without mutating search positions', (rows, cols) => {
    for (let game = 0; game < 6; game++) {
      const board = createBoard(rows, cols);
      board[rows - 1][game % cols] = 'player';
      let token = 'ai';
      let ended = false;
      for (let move = 1; move < rows * cols; move++) {
        const before = cloneBoard(board);
        const col = chooseAiMove(board, token, token === 'ai' ? 'player' : 'ai', 2);
        expect(board).toEqual(before);
        expect(getDropRow(board, col)).toBeGreaterThanOrEqual(0);
        board[getDropRow(board, col)][col] = token;
        if (getWinningCells(board, token) || isFull(board)) { ended = true; break; }
        token = token === 'ai' ? 'player' : 'ai';
      }
      expect(ended).toBe(true);
    }
  });
});

describe('online snapshots', () => {
  const snapshot = () => ({ players: ['alice', 'bob'], turn: 'alice', winner: null, revision: 0, board: createBoard(7, 8) });
  it('uses the table dimensions and maps both seats correctly', () => {
    const state = snapshot();
    state.board[6][0] = 0; state.board[6][1] = 1;
    expect(mapFourInRowSnapshot(state, 'alice')).toMatchObject({ rows: 7, cols: 8, turn: 'player', board: expect.any(Array) });
    expect(mapFourInRowSnapshot(state, 'bob').board[6].slice(0, 2)).toEqual(['ai', 'player']);
    state.winner = 'bob';
    expect(mapFourInRowSnapshot(state, 'bob').winner).toBe('player');
  });
  it('rejects malformed snapshots and nonplayers', () => {
    expect(mapFourInRowSnapshot(snapshot(), 'other')).toBeNull();
    for (const patch of [{ board: {} }, { revision: -1 }, { players: ['alice', 'alice'] }, { turn: 'other' }, { winner: 'other' }, { board: [[null]] }]) {
      expect(mapFourInRowSnapshot({ ...snapshot(), ...patch }, 'alice')).toBeNull();
    }
  });
});
