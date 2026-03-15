export const CHECKERS_SIZE = 8;

export function createInitialBoard() {
  const board = Array.from({ length: CHECKERS_SIZE }, () =>
    Array(CHECKERS_SIZE).fill(null)
  );
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < CHECKERS_SIZE; c += 1) {
      if ((r + c) % 2 === 1) board[r][c] = { side: 'dark', king: false };
    }
  }
  for (let r = 5; r < CHECKERS_SIZE; r += 1) {
    for (let c = 0; c < CHECKERS_SIZE; c += 1) {
      if ((r + c) % 2 === 1) board[r][c] = { side: 'light', king: false };
    }
  }
  return board;
}

export function copyBoard(board) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function inBounds(r, c) {
  return r >= 0 && r < CHECKERS_SIZE && c >= 0 && c < CHECKERS_SIZE;
}

function moveDirsForPiece(piece) {
  if (piece.king) {
    return [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ];
  }
  return piece.side === 'light'
    ? [
        [-1, 1],
        [-1, -1]
      ]
    : [
        [1, 1],
        [1, -1]
      ];
}

export function getPieceMoves(board, r, c, opts = {}) {
  const piece = board[r]?.[c];
  if (!piece) return [];
  const captures = [];
  const normals = [];
  moveDirsForPiece(piece).forEach(([dr, dc]) => {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) return;
    if (!board[nr][nc] && !opts.captureOnly) {
      normals.push({ r: nr, c: nc, capture: null });
      return;
    }
    if (board[nr][nc] && board[nr][nc].side !== piece.side) {
      const jr = nr + dr;
      const jc = nc + dc;
      if (inBounds(jr, jc) && !board[jr][jc]) {
        captures.push({ r: jr, c: jc, capture: [nr, nc] });
      }
    }
  });
  return captures.length ? captures : normals;
}

export function getLegalMoves(board, side, forcedPiece = null) {
  const captures = [];
  const normals = [];
  const pieces = [];
  if (forcedPiece) {
    pieces.push(forcedPiece);
  } else {
    for (let r = 0; r < CHECKERS_SIZE; r += 1) {
      for (let c = 0; c < CHECKERS_SIZE; c += 1) {
        if (board[r][c]?.side === side) pieces.push({ r, c });
      }
    }
  }

  pieces.forEach(({ r, c }) => {
    const pieceMoves = getPieceMoves(board, r, c, {
      captureOnly: Boolean(forcedPiece)
    });
    pieceMoves.forEach((move) => {
      const decorated = { from: { r, c }, to: { r: move.r, c: move.c }, capture: move.capture };
      if (move.capture) captures.push(decorated);
      else normals.push(decorated);
    });
  });

  if (captures.length) return captures;
  if (forcedPiece) return [];
  return normals;
}

function crownPiece(piece, row) {
  if (piece.side === 'light' && row === 0) piece.king = true;
  if (piece.side === 'dark' && row === CHECKERS_SIZE - 1) piece.king = true;
}

export function applyMove(board, move) {
  const next = copyBoard(board);
  const moving = next[move.from.r][move.from.c];
  next[move.from.r][move.from.c] = null;
  if (move.capture) next[move.capture[0]][move.capture[1]] = null;
  crownPiece(moving, move.to.r);
  next[move.to.r][move.to.c] = moving;

  const followUps = move.capture
    ? getPieceMoves(next, move.to.r, move.to.c, { captureOnly: true }).filter(
        (entry) => entry.capture
      )
    : [];

  return {
    board: next,
    mustContinue: followUps.length > 0,
    forcedPiece: followUps.length ? { r: move.to.r, c: move.to.c } : null,
    wasCapture: Boolean(move.capture)
  };
}

function countPieces(board, side) {
  let count = 0;
  for (let r = 0; r < CHECKERS_SIZE; r += 1)
    for (let c = 0; c < CHECKERS_SIZE; c += 1)
      if (board[r][c]?.side === side) count += 1;
  return count;
}

export function getGameState(board, turnSide, forcedPiece = null) {
  const lightCount = countPieces(board, 'light');
  const darkCount = countPieces(board, 'dark');
  if (lightCount === 0) return { finished: true, winner: 'dark' };
  if (darkCount === 0) return { finished: true, winner: 'light' };
  const legal = getLegalMoves(board, turnSide, forcedPiece);
  if (!legal.length) {
    return { finished: true, winner: turnSide === 'light' ? 'dark' : 'light' };
  }
  return { finished: false, winner: null };
}

function evaluateBoard(board, side) {
  let score = 0;
  for (let r = 0; r < CHECKERS_SIZE; r += 1) {
    for (let c = 0; c < CHECKERS_SIZE; c += 1) {
      const piece = board[r][c];
      if (!piece) continue;
      const val = piece.king ? 5 : 3;
      const advance = piece.side === 'dark' ? r * 0.08 : (7 - r) * 0.08;
      const sign = piece.side === side ? 1 : -1;
      score += sign * (val + advance);
      if (r > 1 && r < 6 && c > 1 && c < 6) score += sign * 0.15;
    }
  }
  return score;
}

function opponent(side) {
  return side === 'light' ? 'dark' : 'light';
}

function minimax(state, depth, alpha, beta, maximizingFor) {
  const game = getGameState(state.board, state.turn, state.forcedPiece);
  if (depth === 0 || game.finished) {
    if (game.finished) {
      if (game.winner === maximizingFor) return { score: 1000 + depth };
      return { score: -1000 - depth };
    }
    return { score: evaluateBoard(state.board, maximizingFor) };
  }

  const moves = getLegalMoves(state.board, state.turn, state.forcedPiece);
  const isMax = state.turn === maximizingFor;
  let bestMove = null;
  let bestScore = isMax ? -Infinity : Infinity;

  for (const move of moves) {
    const applied = applyMove(state.board, move);
    const nextState = {
      board: applied.board,
      turn: applied.mustContinue ? state.turn : opponent(state.turn),
      forcedPiece: applied.mustContinue ? applied.forcedPiece : null
    };
    const result = minimax(nextState, depth - 1, alpha, beta, maximizingFor);

    if (isMax) {
      if (result.score > bestScore) {
        bestScore = result.score;
        bestMove = move;
      }
      alpha = Math.max(alpha, bestScore);
    } else {
      if (result.score < bestScore) {
        bestScore = result.score;
        bestMove = move;
      }
      beta = Math.min(beta, bestScore);
    }
    if (beta <= alpha) break;
  }

  return { score: bestScore, move: bestMove };
}

export function getBestAIMove(board, side, forcedPiece = null, depth = 5) {
  const legal = getLegalMoves(board, side, forcedPiece);
  if (!legal.length) return null;
  const result = minimax(
    { board, turn: side, forcedPiece },
    depth,
    -Infinity,
    Infinity,
    side
  );
  return result.move || legal[0];
}
