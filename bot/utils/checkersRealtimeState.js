import { createInitialBoard, normalizeBoard, SIDES } from './checkersAuthoritativeEngine.js';

export function createInitialCheckersBoard() {
  return createInitialBoard();
}

export function createCheckersRealtimeStore() {
  const stateByTable = new Map();

  const getState = (tableId) => {
    if (!stateByTable.has(tableId)) {
      stateByTable.set(tableId, {
        board: createInitialCheckersBoard(),
        turn: SIDES.LIGHT,
        lastMove: null,
        requiredFrom: null,
        winner: null,
        reason: null,
        moveSeq: 0,
        updatedAt: Date.now()
      });
    }
    return stateByTable.get(tableId);
  };

  const setState = (tableId, nextState = {}) => {
    const base = getState(tableId);
    const merged = {
      ...base,
      ...nextState,
      updatedAt: Date.now()
    };
    if (nextState.board) {
      merged.board = normalizeBoard(nextState.board) || base.board;
    }
    if (nextState.turn !== SIDES.LIGHT && nextState.turn !== SIDES.DARK) {
      merged.turn = base.turn;
    }
    if (
      nextState.requiredFrom &&
      (!Number.isInteger(nextState.requiredFrom.r) || !Number.isInteger(nextState.requiredFrom.c))
    ) {
      merged.requiredFrom = base.requiredFrom;
    }
    stateByTable.set(tableId, merged);
    return merged;
  };

  const updateState = (tableId, nextState = {}) => setState(tableId, nextState);

  const clearState = (tableId) => {
    stateByTable.delete(tableId);
  };

  return { getState, setState, updateState, clearState };
}
