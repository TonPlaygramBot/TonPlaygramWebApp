import {
  createInitialBoard,
  getLegalMoves,
  applyMove,
  getBestAIMove,
  getGameState
} from '../webapp/src/utils/checkersEngine.js';

describe('checkersEngine', () => {
  test('initial board has legal moves for both sides', () => {
    const board = createInitialBoard();
    expect(getLegalMoves(board, 'light').length).toBeGreaterThan(0);
    expect(getLegalMoves(board, 'dark').length).toBeGreaterThan(0);
  });

  test('capture is mandatory when available', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[4][3] = { side: 'light', king: false };
    board[3][4] = { side: 'dark', king: false };
    board[5][0] = { side: 'light', king: false };

    const moves = getLegalMoves(board, 'light');
    expect(moves).toHaveLength(1);
    expect(moves[0].capture).toEqual([3, 4]);
  });

  test('ai prefers capture move', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[2][1] = { side: 'dark', king: false };
    board[3][2] = { side: 'light', king: false };

    const move = getBestAIMove(board, 'dark');
    expect(move.capture).toEqual([3, 2]);

    const applied = applyMove(board, move);
    const state = getGameState(applied.board, 'light');
    expect(state.finished).toBe(true);
    expect(state.winner).toBe('dark');
  });
});
