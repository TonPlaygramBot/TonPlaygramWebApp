// English/American movement rules. Battle Royal uses light as the opening side.
const SIZE = 8;
const SIDES = Object.freeze({ LIGHT: 'light', DARK: 'dark' });

export function inBounds(r, c) {
  return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

export function cloneBoard(board) {
  return board.map((row) => row.map((cell) => (cell ? { side: cell.side, king: Boolean(cell.king) } : null)));
}

export function createInitialBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if ((r + c) % 2 === 1) board[r][c] = { side: SIDES.DARK, king: false };
    }
  }
  for (let r = 5; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if ((r + c) % 2 === 1) board[r][c] = { side: SIDES.LIGHT, king: false };
    }
  }
  return board;
}

export function normalizeBoard(board) {
  if (!Array.isArray(board) || board.length !== SIZE) return null;
  const normalized = [];
  for (let r = 0; r < SIZE; r += 1) {
    const row = board[r];
    if (!Array.isArray(row) || row.length !== SIZE) return null;
    const nextRow = [];
    for (let c = 0; c < SIZE; c += 1) {
      const cell = row[c];
      if (cell == null) nextRow.push(null);
      else {
        if ((r + c) % 2 === 0 || ![SIDES.LIGHT, SIDES.DARK].includes(cell.side)) return null;
        nextRow.push({ side: cell.side, king: Boolean(cell.king) });
      }
    }
    normalized.push(nextRow);
  }
  return normalized;
}

function getPieceDirs(piece) {
  if (piece.king) {
    return [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ];
  }
  return piece.side === SIDES.LIGHT
    ? [
        [-1, 1],
        [-1, -1]
      ]
    : [
        [1, 1],
        [1, -1]
      ];
}

export function getPieceMoves(board, from) {
  const piece = board?.[from.r]?.[from.c];
  if (!piece) return [];
  const captures = [];
  const normals = [];
  for (const [dr, dc] of getPieceDirs(piece)) {
    const nr = from.r + dr;
    const nc = from.c + dc;
    if (!inBounds(nr, nc)) continue;
    if (!board[nr][nc]) {
      normals.push({ from, to: { r: nr, c: nc }, capture: null });
      continue;
    }
    if (board[nr][nc].side === piece.side) continue;
    const jr = nr + dr;
    const jc = nc + dc;
    if (inBounds(jr, jc) && !board[jr][jc]) {
      captures.push({ from, to: { r: jr, c: jc }, capture: { r: nr, c: nc } });
    }
  }
  return captures.length ? captures : normals;
}

export function getLegalMovesForSide(board, side) {
  const captures = [];
  const normals = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const piece = board?.[r]?.[c];
      if (!piece || piece.side !== side) continue;
      const moves = getPieceMoves(board, { r, c });
      for (const mv of moves) {
        if (mv.capture) captures.push(mv);
        else normals.push(mv);
      }
    }
  }
  return captures.length ? captures : normals;
}

function crownIfNeeded(piece, row) {
  if (piece.side === SIDES.LIGHT && row === 0) return { ...piece, king: true };
  if (piece.side === SIDES.DARK && row === SIZE - 1) return { ...piece, king: true };
  return { ...piece };
}

export function findWinner(board, turn) {
  let light = 0;
  let dark = 0;
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const piece = board[r][c];
      if (!piece) continue;
      if (piece.side === SIDES.LIGHT) light += 1;
      if (piece.side === SIDES.DARK) dark += 1;
    }
  }
  if (light === 0) return { winner: SIDES.DARK, reason: 'all_light_captured' };
  if (dark === 0) return { winner: SIDES.LIGHT, reason: 'all_dark_captured' };

  const nextMoves = getLegalMovesForSide(board, turn);
  if (!nextMoves.length) {
    return {
      winner: turn === SIDES.LIGHT ? SIDES.DARK : SIDES.LIGHT,
      reason: 'no_legal_moves'
    };
  }
  return null;
}

export function applyAuthoritativeMove(state, payload) {
  if (state?.winner || state?.draw || state?.finished) return { ok: false, error: 'game_finished' };
  const board = normalizeBoard(state?.board);
  if (!board) return { ok: false, error: 'invalid_board' };
  if (state?.requiredFrom && !inBounds(state.requiredFrom.r, state.requiredFrom.c)) {
    return { ok: false, error: 'invalid_chain_state' };
  }
  const turn = state?.turn === SIDES.DARK ? SIDES.DARK : SIDES.LIGHT;
  const requiredFrom = state?.requiredFrom && inBounds(state.requiredFrom.r, state.requiredFrom.c)
    ? state.requiredFrom
    : null;
  const from = payload?.from;
  const to = payload?.to;

  if (!inBounds(from?.r, from?.c) || !inBounds(to?.r, to?.c)) {
    return { ok: false, error: 'invalid_coordinates' };
  }

  if (requiredFrom && (requiredFrom.r !== from.r || requiredFrom.c !== from.c)) {
    return { ok: false, error: 'chain_capture_required_piece' };
  }

  const piece = board?.[from.r]?.[from.c];
  if (!piece) return { ok: false, error: 'piece_not_found' };
  if (piece.side !== turn) return { ok: false, error: 'not_your_turn_piece' };

  const legalMoves = requiredFrom
    ? getPieceMoves(board, from).filter((mv) => mv.capture)
    : getLegalMovesForSide(board, turn);
  const selected = legalMoves.find((mv) => mv.from.r === from.r && mv.from.c === from.c && mv.to.r === to.r && mv.to.c === to.c);
  if (!selected) return { ok: false, error: 'illegal_move' };

  const nextBoard = cloneBoard(board);
  nextBoard[from.r][from.c] = null;
  if (selected.capture) {
    nextBoard[selected.capture.r][selected.capture.c] = null;
  }
  const movedPiece = crownIfNeeded(piece, to.r);
  nextBoard[to.r][to.c] = movedPiece;

  const promoted = !piece.king && movedPiece.king;
  const followUpCaptures = selected.capture && !promoted
    ? getPieceMoves(nextBoard, to).filter((mv) => mv.capture)
    : [];

  const turnAfter = followUpCaptures.length ? turn : turn === SIDES.LIGHT ? SIDES.DARK : SIDES.LIGHT;
  const requiredFromAfter = followUpCaptures.length ? { ...to } : null;
  const winner = followUpCaptures.length ? null : findWinner(nextBoard, turnAfter);

  // Count only completed turns. A capture or an uncrowned move resets the
  // 40-move rule; an intermediate jump is never a repetition position.
  const progress = Boolean(selected.capture) || !piece.king;
  const quietPlies = progress ? 0 : (state.quietPlies || 0) + 1;
  let positionCounts = state.positionCounts || { [positionKey(board, turn)]: 1 };
  let draw = false;
  let drawReason = null;
  if (state.trackDraws !== false && !requiredFromAfter) {
    const key = positionKey(nextBoard, turnAfter);
    positionCounts = progress ? { [key]: 1 } : {
      ...positionCounts, [key]: (positionCounts[key] || 0) + 1
    };
    if (!winner && positionCounts[key] >= 3) drawReason = 'threefold_repetition';
    if (!winner && quietPlies >= 80) drawReason = 'forty_move_rule';
    draw = Boolean(drawReason);
  }

  return {
    ok: true,
    board: nextBoard,
    turn: turnAfter,
    requiredFrom: requiredFromAfter,
    chainCapture: followUpCaptures.length > 0,
    promoted,
    quietPlies,
    positionCounts,
    draw,
    lastMove: {
      from: { ...from },
      to: { ...to },
      capture: selected.capture ? { ...selected.capture } : null,
      side: piece.side
    },
    winner: winner?.winner || null,
    reason: winner?.reason || drawReason || null
  };
}

export function positionKey(board, turn) {
  return `${turn}:${board.flat().map((piece) => !piece ? '.' :
    piece.side === SIDES.LIGHT ? (piece.king ? 'L' : 'l') : (piece.king ? 'D' : 'd')).join('')}`;
}

export function oppositeSide(side) {
  return side === SIDES.LIGHT ? SIDES.DARK : SIDES.LIGHT;
}

export { SIZE, SIDES };
