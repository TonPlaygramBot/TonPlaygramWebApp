import {
  START_FEN,
  parseFEN,
  parseWireBoard,
  setBoardState,
  getBoardState,
  boardToFEN,
  inBoard,
  generateMoves,
  applyMove,
  positionKey,
  getGameOutcome,
  getTimeoutOutcome
} from '../webapp/src/games/chess/chessRules.mjs';

export const createInitialChessBoard = () => parseFEN(START_FEN);
export const normalizeChessBoard = (board) =>
  parseWireBoard(board) || createInitialChessBoard();
export const chessBoardToFen = boardToFEN;

export function adjudicateChessTimeout(state, now = Date.now()) {
  if (
    !state.turnDeadline ||
    state.winner ||
    state.draw ||
    now < state.turnDeadline
  )
    return null;
  return {
    ...getTimeoutOutcome(state.board, state.turnWhite),
    turnDeadline: null
  };
}

export function validateAndApplyChessMove(state, playerId, move = {}) {
  if (state.winner || state.draw) return { ok: false, error: 'game_finished' };
  if (state.turnDeadline && Date.now() >= state.turnDeadline)
    return { ok: false, error: 'turn_expired' };
  const player = (state.players || []).find(
    (p) => String(p.id) === String(playerId)
  );
  if (!['white', 'black'].includes(player?.side))
    return { ok: false, error: 'seat_required' };
  if (player.side !== (state.turnWhite ? 'white' : 'black'))
    return { ok: false, error: 'wrong_player_turn' };
  const board = normalizeChessBoard(state.board);
  setBoardState(
    board,
    state.rules ||
      (state.fen
        ? getBoardState(parseFEN(state.fen))
        : { turnWhite: state.turnWhite })
  );
  const counts = { ...(state.positionCounts || {}) };
  const beforeKey = positionKey(board, state.turnWhite);
  counts[beforeKey] = Math.max(1, counts[beforeKey] || 0);
  if (move.claimDraw && !move.lastMove) {
    const outcome = getGameOutcome(
      board,
      state.turnWhite,
      counts[beforeKey],
      true
    );
    if (!outcome.draw) return { ok: false, error: 'draw_not_claimable' };
    return { ok: true, state: { ...state, ...outcome } };
  }
  const from = move.lastMove?.from || {},
    to = move.lastMove?.to || {};
  const coords = [from.r, from.c, to.r, to.c];
  if (
    !coords.every(Number.isInteger) ||
    !inBoard(from.r, from.c) ||
    !inBoard(to.r, to.c)
  )
    return { ok: false, error: 'invalid_coordinates' };
  const piece = board[from.r][from.c];
  if (!piece) return { ok: false, error: 'empty_source' };
  if (piece.w !== state.turnWhite)
    return { ok: false, error: 'wrong_turn_piece' };
  const promotes = piece.t === 'P' && (to.r === 0 || to.r === 7);
  const promotion =
    move.lastMove?.promotion ?? move.promotion ?? (promotes ? 'Q' : null);
  const legal = generateMoves(board, state.turnWhite, {
    fromR: from.r,
    fromC: from.c
  }).find((m) => m.toR === to.r && m.toC === to.c && m.promotion === promotion);
  if (!legal) return { ok: false, error: 'illegal_move' };
  applyMove(board, from.r, from.c, to.r, to.c, promotion || 'Q');
  const turnWhite = !state.turnWhite;
  const key = positionKey(board, turnWhite);
  counts[key] = (counts[key] || 0) + 1;
  const outcome = getGameOutcome(
    board,
    turnWhite,
    counts[key],
    Boolean(move.claimDraw)
  );
  return {
    ok: true,
    state: {
      board,
      fen: boardToFEN(board, turnWhite),
      rules: getBoardState(board),
      turnWhite,
      lastMove: {
        from: { r: from.r, c: from.c },
        to: { r: to.r, c: to.c },
        promotion
      },
      ...outcome,
      positionCounts: counts,
      moveSeq: Number(state.moveSeq || 0) + 1,
      // Reserve a bounded presentation interval before the next player's clock.
      // This is derived from the validated move, never a client-provided value.
      turnDeadline:
        Date.now() +
        60000 +
        (legal.captured
          ? 15000
          : piece.t === 'K' && Math.abs(to.c - from.c) === 2
            ? 3200
            : 1600)
    }
  };
}
