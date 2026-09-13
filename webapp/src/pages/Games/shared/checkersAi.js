import {
  applyAuthoritativeMove, getLegalMovesForSide, getPieceMoves
} from '../../../../../shared/checkersRules.js';

const toDisplayMove = ({ from, to, capture }) => ({
  from, r: to.r, c: to.c,
  ...(capture ? { capture: [capture.r, capture.c] } : {})
});

export const getMovesForSide = (board, side, requiredFrom = null) =>
  (requiredFrom
    ? getPieceMoves(board, requiredFrom).filter((move) => move.capture)
    : getLegalMovesForSide(board, side)).map(toDisplayMove);

export function applyMoveToBoard(board, move, state = {}) {
  const result = applyAuthoritativeMove({
    trackDraws: false, ...state, board,
    turn: state.turn || board[move.from.r]?.[move.from.c]?.side
  }, { from: move.from, to: { r: move.r, c: move.c } });
  if (!result.ok) return null;
  return {
    ...result,
    piece: result.board[move.r][move.c],
    chainCaptures: result.requiredFrom
      ? getMovesForSide(result.board, result.turn, result.requiredFrom) : []
  };
}

function evaluateBoard(board) {
  let score = 0;
  board.forEach((row, r) => row.forEach((piece, c) => {
    if (!piece) return;
    const advancement = piece.king ? 0 : piece.side === 'dark' ? r : 7 - r;
    const value = (piece.king ? 180 : 100) + advancement * 6 + (3.5 - Math.abs(c - 3.5)) * 3;
    score += piece.side === 'dark' ? value : -value;
  }));
  return score;
}

// Depth counts whole turns. Both sides must finish every jump with the same
// piece, including at the search horizon. Captures strictly reduce material.
export function searchBestMove(board, side, depth, alpha = -Infinity, beta = Infinity, requiredFrom = null) {
  const moves = getMovesForSide(board, side, requiredFrom);
  if (!moves.length) return { score: side === 'dark' ? -100000 - depth : 100000 + depth, move: null };
  if (depth <= 0 && !requiredFrom) return { score: evaluateBoard(board), move: null };
  const maximizing = side === 'dark';
  let score = maximizing ? -Infinity : Infinity;
  let bestMove = null;
  for (const move of moves) {
    const next = applyMoveToBoard(board, move, { turn: side, requiredFrom });
    if (!next) continue;
    const childScore = next.winner
      ? (next.winner === 'dark' ? 100000 + depth : -100000 - depth)
      : searchBestMove(next.board, next.turn, depth - (next.requiredFrom ? 0 : 1), alpha, beta, next.requiredFrom).score;
    if (bestMove === null || (maximizing ? childScore > score : childScore < score)) {
      score = childScore;
      bestMove = move;
    }
    if (maximizing) alpha = Math.max(alpha, score);
    else beta = Math.min(beta, score);
    if (alpha >= beta) break;
  }
  return { score, move: bestMove };
}
