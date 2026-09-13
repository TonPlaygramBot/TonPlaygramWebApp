export const createBoard = (rows, cols) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
export const cloneBoard = (board) => board.map((row) => [...row]);
export const isFull = (board) => board.every((row) => row.every((cell) => cell != null));

export const getDropRow = (board, col) => {
  if (!Number.isInteger(col) || col < 0 || col >= (board[0]?.length || 0)) return -1;
  for (let r = board.length - 1; r >= 0; r -= 1) {
    if (board[r][col] == null) return r;
  }
  return -1;
};

export const getWinningCells = (board, token) => {
  if (token == null || !board.length || !board[0]?.length) return null;
  const rows = board.length;
  const cols = board[0].length;
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [-1, 1]
  ];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (board[r][c] !== token) continue;
      for (const [dr, dc] of dirs) {
        const cells = [[r, c]];
        let ok = true;
        for (let i = 1; i < 4; i += 1) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (
            nr < 0 ||
            nr >= rows ||
            nc < 0 ||
            nc >= cols ||
            board[nr][nc] !== token
          ) {
            ok = false;
            break;
          }
          cells.push([nr, nc]);
        }
        if (ok) return cells;
      }
    }
  }
  return null;
};

const checkWinner = (board, token) => Boolean(getWinningCells(board, token));

const evaluateWindow = (window, aiToken, playerToken) => {
  const aiCount = window.filter((v) => v === aiToken).length;
  const playerCount = window.filter((v) => v === playerToken).length;
  const empty = window.filter((v) => v == null).length;
  if (aiCount === 4) return 1000;
  if (aiCount === 3 && empty === 1) return 25;
  if (aiCount === 2 && empty === 2) return 6;
  if (playerCount === 3 && empty === 1) return -35;
  return 0;
};

const scorePosition = (board, aiToken, playerToken) => {
  const rows = board.length;
  const cols = board[0].length;
  let score = 0;
  const centerCol = Math.floor(cols / 2);
  for (let r = 0; r < rows; r += 1) {
    if (board[r][centerCol] === aiToken) score += 3;
  }
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols - 3; c += 1)
      score += evaluateWindow(
        [board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]],
        aiToken,
        playerToken
      );
  }
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows - 3; r += 1)
      score += evaluateWindow(
        [board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]],
        aiToken,
        playerToken
      );
  }
  for (let r = 0; r < rows - 3; r += 1) {
    for (let c = 0; c < cols - 3; c += 1)
      score += evaluateWindow(
        [
          board[r][c],
          board[r + 1][c + 1],
          board[r + 2][c + 2],
          board[r + 3][c + 3]
        ],
        aiToken,
        playerToken
      );
  }
  for (let r = 3; r < rows; r += 1) {
    for (let c = 0; c < cols - 3; c += 1)
      score += evaluateWindow(
        [
          board[r][c],
          board[r - 1][c + 1],
          board[r - 2][c + 2],
          board[r - 3][c + 3]
        ],
        aiToken,
        playerToken
      );
  }
  return score;
};

const minimax = (
  board,
  depth,
  alpha,
  beta,
  maximizing,
  aiToken,
  playerToken
) => {
  const cols = board[0].length;
  const validCols = Array.from({ length: cols }, (_, i) => i).filter(
    (col) => getDropRow(board, col) >= 0
  ).sort((a, b) => Math.abs(a - (cols - 1) / 2) - Math.abs(b - (cols - 1) / 2));
  const terminal =
    checkWinner(board, aiToken) ||
    checkWinner(board, playerToken) ||
    validCols.length === 0;
  if (depth === 0 || terminal) {
    if (checkWinner(board, aiToken)) return { score: 1_000_000 + depth };
    if (checkWinner(board, playerToken)) return { score: -1_000_000 - depth };
    if (validCols.length === 0) return { score: 0 };
    return { score: scorePosition(board, aiToken, playerToken) };
  }

  if (maximizing) {
    let best = { col: validCols[0], score: -Infinity };
    for (const col of validCols) {
      const row = getDropRow(board, col);
      const next = cloneBoard(board);
      next[row][col] = aiToken;
      const val = minimax(
        next,
        depth - 1,
        alpha,
        beta,
        false,
        aiToken,
        playerToken
      ).score;
      if (val > best.score) best = { col, score: val };
      alpha = Math.max(alpha, val);
      if (alpha >= beta) break;
    }
    return best;
  }

  let best = { col: validCols[0], score: Infinity };
  for (const col of validCols) {
    const row = getDropRow(board, col);
    const next = cloneBoard(board);
    next[row][col] = playerToken;
    const val = minimax(
      next,
      depth - 1,
      alpha,
      beta,
      true,
      aiToken,
      playerToken
    ).score;
    if (val < best.score) best = { col, score: val };
    beta = Math.min(beta, val);
    if (alpha >= beta) break;
  }
  return best;
};

export const chooseAiMove = (board, aiToken, playerToken, depth) => {
  const cols = board[0].length;
  const validCols = Array.from({ length: cols }, (_, i) => i).filter(
    (col) => getDropRow(board, col) >= 0
  ).sort((a, b) => Math.abs(a - (cols - 1) / 2) - Math.abs(b - (cols - 1) / 2));
  if (!validCols.length) return null;

  for (const col of validCols) {
    const row = getDropRow(board, col);
    const next = cloneBoard(board);
    next[row][col] = aiToken;
    if (checkWinner(next, aiToken)) return col;
  }

  for (const col of validCols) {
    const row = getDropRow(board, col);
    const next = cloneBoard(board);
    next[row][col] = playerToken;
    if (checkWinner(next, playerToken)) return col;
  }

  const { col } = minimax(
    board,
    depth,
    -Infinity,
    Infinity,
    true,
    aiToken,
    playerToken
  );
  return Number.isInteger(col) ? col : validCols[0];
};

export function mapFourInRowSnapshot(state, accountId) {
  if (!state || !Array.isArray(state.board)) return null;
  if (!Array.isArray(state.players) || state.players.length !== 2) return null;
  const players = state.players.map(String);
  if (new Set(players).size !== 2 || !players.includes(String(state.turn))) return null;
  if (state.winner != null && state.winner !== 'draw' && !players.includes(String(state.winner))) return null;
  const myIndex = state.players.findIndex((id) => String(id) === String(accountId));
  const rows = state.board?.length;
  const cols = state.board?.[0]?.length;
  if (myIndex < 0 || !((rows === 6 && cols === 7) || (rows === 7 && cols === 8))) return null;
  if (!state.board.every((row) => Array.isArray(row) && row.length === cols &&
    row.every((cell) => cell == null || cell === 0 || cell === 1))) return null;
  if (!Number.isInteger(state.revision) || state.revision < 0) return null;
  const board = state.board.map((row) => row.map((token) => token == null ? null : token === myIndex ? 'player' : 'ai'));
  const winner = state.winner === 'draw' ? 'draw' : state.winner == null ? null : String(state.winner) === String(accountId) ? 'player' : 'ai';
  return {
    rows, cols, board, winner, revision: state.revision,
    turn: String(state.turn) === String(accountId) ? 'player' : 'ai',
    winningCells: winner && winner !== 'draw' ? getWinningCells(board, winner) || [] : []
  };
}
