const SIZE = 8;

export function createInitialCheckersBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if ((r + c) % 2 === 1) board[r][c] = { side: 'dark', king: false };
    }
  }
  for (let r = 5; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if ((r + c) % 2 === 1) board[r][c] = { side: 'light', king: false };
    }
  }
  return board;
}

function normalizeBoard(board) {
  if (!Array.isArray(board) || board.length !== SIZE) return null;
  const normalized = board.map((row) => {
    if (!Array.isArray(row) || row.length !== SIZE) return null;
    return row.map((cell) => {
      if (!cell || typeof cell !== 'object') return null;
      const side = cell.side === 'light' || cell.side === 'dark' ? cell.side : null;
      if (!side) return null;
      return { side, king: Boolean(cell.king) };
    });
  });
  if (normalized.some((row) => row == null)) return null;
  return normalized;
}

export function createCheckersRealtimeStore() {
  const stateByTable = new Map();

  const getState = (tableId) => {
    if (!stateByTable.has(tableId)) {
      stateByTable.set(tableId, {
        board: createInitialCheckersBoard(),
        turn: 'light',
        lastMove: null,
        updatedAt: Date.now()
      });
    }
    return stateByTable.get(tableId);
  };

  const updateState = (tableId, nextState = {}) => {
    const base = getState(tableId);
    const merged = {
      ...base,
      ...nextState,
      updatedAt: Date.now()
    };
    if (nextState.board) {
      merged.board = normalizeBoard(nextState.board) || base.board;
    }
    if (nextState.turn !== 'light' && nextState.turn !== 'dark') {
      merged.turn = base.turn;
    }
    stateByTable.set(tableId, merged);
    return merged;
  };

  const clearState = (tableId) => {
    stateByTable.delete(tableId);
  };

  return { getState, updateState, clearState };
}
