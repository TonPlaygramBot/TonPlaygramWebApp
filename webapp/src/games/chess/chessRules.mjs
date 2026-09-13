// Shared by the browser, AI and authoritative server. Board coordinates are
// always a8 = [0, 0], independent of the camera/player's orientation.
export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const PROMOTIONS = ['Q', 'R', 'B', 'N'];
const KN = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1]
];
const DIAGONALS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1]
];
const STRAIGHTS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];
export const inBoard = (r, c) =>
  Number.isInteger(r) &&
  Number.isInteger(c) &&
  r >= 0 &&
  r < 8 &&
  c >= 0 &&
  c < 8;
export function setBoardState(board, state = {}) {
  Object.defineProperty(board, 'chessState', {
    configurable: true,
    writable: true,
    enumerable: false,
    value: {
      turnWhite: state.turnWhite !== false,
      enPassant: state.enPassant ? [...state.enPassant] : null,
      halfmove: Math.max(0, Number(state.halfmove) || 0),
      fullmove: Math.max(1, Number(state.fullmove) || 1)
    }
  });
  return board;
}
export const getBoardState = (board) =>
  board.chessState || {
    turnWhite: true,
    enPassant: null,
    halfmove: 0,
    fullmove: 1
  };
export function parseFEN(fen) {
  const [
    placement,
    turn = 'w',
    rights = '-',
    ep = '-',
    halfmove = '0',
    fullmove = '1'
  ] = String(fen).trim().split(/\s+/);
  const rows = placement.split('/');
  if (rows.length !== 8) throw new Error('Invalid FEN board');
  const board = rows.map((row) => {
    const cells = [];
    for (const ch of row) {
      if (/[1-8]/.test(ch)) cells.push(...Array(Number(ch)).fill(null));
      else if (/[pnbrqk]/i.test(ch))
        cells.push({
          t: ch.toUpperCase(),
          w: ch === ch.toUpperCase(),
          hasMoved: true
        });
      else throw new Error('Invalid FEN piece');
    }
    if (cells.length !== 8) throw new Error('Invalid FEN row');
    return cells;
  });
  // Placement-only input has no historical castling rights. The starting FEN
  // includes them explicitly; reconnects must preserve the complete FEN.
  for (const [right, r, c, white] of [
    ['K', 7, 7, true],
    ['Q', 7, 0, true],
    ['k', 0, 7, false],
    ['q', 0, 0, false]
  ]) {
    if (
      rights.includes(right) &&
      board[r][4]?.t === 'K' &&
      board[r][4]?.w === white &&
      board[r][c]?.t === 'R' &&
      board[r][c]?.w === white
    ) {
      board[r][4].hasMoved = false;
      board[r][c].hasMoved = false;
    }
  }
  return setBoardState(board, {
    turnWhite: turn === 'w',
    enPassant: /^[a-h][36]$/.test(ep)
      ? [8 - Number(ep[1]), ep.charCodeAt(0) - 97]
      : null,
    halfmove,
    fullmove
  });
}
export function castlingRights(board) {
  let rights = '';
  for (const [r, white, k, q] of [
    [7, true, 'K', 'Q'],
    [0, false, 'k', 'q']
  ]) {
    const king = board[r][4];
    if (king?.t !== 'K' || king.w !== white || king.hasMoved) continue;
    for (const [c, right] of [
      [7, k],
      [0, q]
    ]) {
      const rook = board[r][c];
      if (rook?.t === 'R' && rook.w === white && !rook.hasMoved)
        rights += right;
    }
  }
  return rights || '-';
}
export function boardToFEN(
  board,
  whiteToMove = getBoardState(board).turnWhite
) {
  const placement = board
    .map((row) => {
      let out = '',
        empty = 0;
      for (const p of row) {
        if (!p) {
          empty++;
          continue;
        }
        if (empty) {
          out += empty;
          empty = 0;
        }
        out += p.w ? p.t : p.t.toLowerCase();
      }
      return out + (empty || '');
    })
    .join('/');
  const state = getBoardState(board),
    ep = state.enPassant;
  return `${placement} ${whiteToMove ? 'w' : 'b'} ${castlingRights(board)} ${ep ? String.fromCharCode(97 + ep[1]) + (8 - ep[0]) : '-'} ${state.halfmove} ${state.fullmove}`;
}
export const cloneBoard = (board) =>
  setBoardState(
    board.map((row) => row.map((p) => (p ? { ...p } : null))),
    getBoardState(board)
  );
export const boardToWireBoard = (board) =>
  board.map((row) => row.map((p) => (p ? { ...p } : null)));
export function parseWireBoard(board) {
  if (
    !Array.isArray(board) ||
    board.length !== 8 ||
    board.some((row) => !Array.isArray(row) || row.length !== 8)
  )
    return null;
  if (
    board.some((row) =>
      row.some(
        (p) =>
          p !== null &&
          (!p ||
            !'PNBRQK'.includes(p.t) ||
            p.t.length !== 1 ||
            typeof p.w !== 'boolean')
      )
    )
  )
    return null;
  return cloneBoard(board);
}
export function findKing(board, white) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.t === 'K' && board[r][c].w === white) return [r, c];
  return null;
}
export function isSquareAttacked(board, r, c, white) {
  // Attacks differ from legal destinations: pawns attack empty diagonals,
  // never their forward push; pinned pieces still defend their squares.
  const pawnR = r + (white ? 1 : -1);
  for (const dc of [-1, 1])
    if (
      inBoard(pawnR, c + dc) &&
      board[pawnR][c + dc]?.t === 'P' &&
      board[pawnR][c + dc].w === white
    )
      return true;
  for (const [dr, dc] of KN)
    if (
      inBoard(r + dr, c + dc) &&
      board[r + dr][c + dc]?.t === 'N' &&
      board[r + dr][c + dc].w === white
    )
      return true;
  for (const [dr, dc] of [...DIAGONALS, ...STRAIGHTS]) {
    let rr = r + dr,
      cc = c + dc,
      distance = 1;
    while (inBoard(rr, cc)) {
      const p = board[rr][cc];
      if (p) {
        if (
          p.w === white &&
          (p.t === 'Q' ||
            p.t === (dr && dc ? 'B' : 'R') ||
            (distance === 1 && p.t === 'K'))
        )
          return true;
        break;
      }
      rr += dr;
      cc += dc;
      distance++;
    }
  }
  return false;
}
export function isPlayerInCheck(board, white) {
  const king = findKing(board, white);
  return !king || isSquareAttacked(board, ...king, !white);
}
export function enPassantCaptureSquare(board, r, c, rr, cc) {
  const p = board[r]?.[c],
    ep = getBoardState(board).enPassant;
  if (
    p?.t !== 'P' ||
    !ep ||
    ep[0] !== rr ||
    ep[1] !== cc ||
    board[rr][cc] ||
    Math.abs(cc - c) !== 1 ||
    rr - r !== (p.w ? -1 : 1)
  )
    return null;
  const victim = board[r][cc];
  return victim?.t === 'P' && victim.w !== p.w ? [r, cc] : null;
}
export function genMoves(board, r, c) {
  const p = board[r]?.[c];
  if (!p) return [];
  const moves = [];
  const push = (rr, cc) => {
    if (
      inBoard(rr, cc) &&
      (!board[rr][cc] || (board[rr][cc].w !== p.w && board[rr][cc].t !== 'K'))
    )
      moves.push([rr, cc]);
  };
  if (p.t === 'P') {
    const dir = p.w ? -1 : 1;
    if (inBoard(r + dir, c) && !board[r + dir][c]) {
      moves.push([r + dir, c]);
      if (r === (p.w ? 6 : 1) && !board[r + 2 * dir][c])
        moves.push([r + 2 * dir, c]);
    }
    for (const dc of [-1, 1])
      if (inBoard(r + dir, c + dc)) {
        const target = board[r + dir][c + dc];
        if (
          (target && target.w !== p.w && target.t !== 'K') ||
          enPassantCaptureSquare(board, r, c, r + dir, c + dc)
        )
          moves.push([r + dir, c + dc]);
      }
  } else if (p.t === 'N') KN.forEach(([dr, dc]) => push(r + dr, c + dc));
  else if (p.t === 'K')
    [...DIAGONALS, ...STRAIGHTS].forEach(([dr, dc]) => push(r + dr, c + dc));
  else {
    const dirs =
      p.t === 'B'
        ? DIAGONALS
        : p.t === 'R'
          ? STRAIGHTS
          : [...DIAGONALS, ...STRAIGHTS];
    for (const [dr, dc] of dirs) {
      let rr = r + dr,
        cc = c + dc;
      while (inBoard(rr, cc)) {
        push(rr, cc);
        if (board[rr][cc]) break;
        rr += dr;
        cc += dc;
      }
    }
  }
  return moves;
}
// Search uses make/unmake to avoid cloning all 64 squares at every node.
export function applyMove(board, r, c, rr, cc, promotion = 'Q') {
  const p = board[r][c];
  if (!p) throw new Error('Empty source');
  const promotes = p.t === 'P' && (rr === 0 || rr === 7);
  if (promotes && !PROMOTIONS.includes(promotion))
    throw new Error('Invalid promotion');
  const ep = enPassantCaptureSquare(board, r, c, rr, cc);
  const capturedAt = ep || [rr, cc];
  const snapshot = {
    captured: board[capturedAt[0]][capturedAt[1]],
    capturedAt,
    previousType: p.t,
    pieceMovedFlag: p.hasMoved,
    promoted: promotes,
    state: getBoardState(board),
    castle: null
  };
  if (p.t === 'K' && r === rr && Math.abs(cc - c) === 2) {
    const rookFromC = cc > c ? 7 : 0,
      rookToC = cc > c ? 5 : 3,
      rookPiece = board[r][rookFromC];
    snapshot.castle = {
      rookFromC,
      rookToC,
      rookPiece,
      rookMovedFlag: rookPiece.hasMoved
    };
    board[r][rookToC] = rookPiece;
    board[r][rookFromC] = null;
    rookPiece.hasMoved = true;
  }
  if (ep) board[ep[0]][ep[1]] = null;
  board[rr][cc] = p;
  board[r][c] = null;
  p.hasMoved = true;
  if (promotes) p.t = promotion;
  setBoardState(board, {
    turnWhite: !p.w,
    enPassant:
      snapshot.previousType === 'P' && Math.abs(rr - r) === 2
        ? [(r + rr) / 2, c]
        : null,
    halfmove:
      snapshot.previousType === 'P' || snapshot.captured
        ? 0
        : snapshot.state.halfmove + 1,
    fullmove: snapshot.state.fullmove + (p.w ? 0 : 1)
  });
  return snapshot;
}
export function revertMove(board, r, c, rr, cc, snapshot) {
  const p = board[rr][cc];
  board[r][c] = p;
  board[rr][cc] = null;
  board[snapshot.capturedAt[0]][snapshot.capturedAt[1]] = snapshot.captured;
  p.t = snapshot.previousType;
  p.hasMoved = snapshot.pieceMovedFlag;
  if (snapshot.castle) {
    const s = snapshot.castle;
    board[r][s.rookFromC] = s.rookPiece;
    board[r][s.rookToC] = null;
    s.rookPiece.hasMoved = s.rookMovedFlag;
  }
  setBoardState(board, snapshot.state);
}
export function getCastlingTargets(board, r, c, white) {
  const king = board[r]?.[c];
  if (
    king?.t !== 'K' ||
    king.w !== white ||
    king.hasMoved ||
    r !== (white ? 7 : 0) ||
    c !== 4 ||
    isPlayerInCheck(board, white)
  )
    return [];
  const result = [];
  for (const [rookC, empty, transit, dest] of [
    [7, [5, 6], 5, 6],
    [0, [1, 2, 3], 3, 2]
  ]) {
    const rook = board[r][rookC];
    if (
      rook?.t !== 'R' ||
      rook.w !== white ||
      rook.hasMoved ||
      empty.some((col) => board[r][col])
    )
      continue;
    // Vacate e1/e8 when testing transit, so the king cannot mask a ray attack.
    board[r][c] = null;
    board[r][transit] = king;
    const attacked = isSquareAttacked(board, r, transit, !white);
    board[r][c] = king;
    board[r][transit] = null;
    if (!attacked) result.push([r, dest]);
  }
  return result;
}
export function generateMoves(
  board,
  white,
  { fromR = null, fromC = null, onlyCaptures = false, limit = Infinity } = {}
) {
  const moves = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (
        !p ||
        p.w !== white ||
        (fromR !== null && (r !== fromR || c !== fromC))
      )
        continue;
      const pseudo = genMoves(board, r, c);
      if (!onlyCaptures && p.t === 'K')
        pseudo.push(...getCastlingTargets(board, r, c, white));
      for (const [rr, cc] of pseudo) {
        const ep = enPassantCaptureSquare(board, r, c, rr, cc),
          target = ep ? board[ep[0]][ep[1]] : board[rr][cc];
        const promotes = p.t === 'P' && (rr === 0 || rr === 7);
        if (onlyCaptures && !target && !promotes) continue;
        for (const promotion of promotes ? PROMOTIONS : [null]) {
          const snapshot = applyMove(board, r, c, rr, cc, promotion || 'Q');
          const safe = !isPlayerInCheck(board, white);
          revertMove(board, r, c, rr, cc, snapshot);
          if (!safe) continue;
          moves.push({
            fromR: r,
            fromC: c,
            toR: rr,
            toC: cc,
            piece: p.t,
            captured: target?.t || null,
            promotion,
            isWhite: white,
            enPassant: !!ep
          });
          if (moves.length >= limit) return moves;
        }
      }
    }
  return moves;
}
export const legalMoves = (board, r, c) =>
  board[r]?.[c]
    ? generateMoves(board, board[r][c].w, { fromR: r, fromC: c }).map((m) => [
        m.toR,
        m.toC
      ])
    : [];
export const anyLegal = (board, white) =>
  generateMoves(board, white, { limit: 1 }).length > 0;
export function positionKey(board, white = getBoardState(board).turnWhite) {
  const fields = boardToFEN(board, white).split(' ');
  // An unusable en-passant target does not distinguish repeated positions.
  if (
    fields[3] !== '-' &&
    !generateMoves(board, white).some((m) => m.enPassant)
  )
    fields[3] = '-';
  return fields.slice(0, 4).join(' ');
}
export function insufficientMaterial(board) {
  const pieces = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] && board[r][c].t !== 'K')
        pieces.push({ ...board[r][c], squareColor: (r + c) % 2 });
  if (!pieces.length) return true;
  if (pieces.length === 1 && ['B', 'N'].includes(pieces[0].t)) return true;
  return (
    pieces.every((p) => p.t === 'B') &&
    pieces.every((p) => p.squareColor === pieces[0].squareColor)
  );
}
export function getGameOutcome(
  board,
  white,
  repetitions = 1,
  claimDraw = false
) {
  const check = isPlayerInCheck(board, white),
    hasMove = anyLegal(board, white);
  if (!hasMove)
    return {
      winner: check ? (white ? 'black' : 'white') : null,
      draw: check ? null : 'stalemate',
      check
    };
  let draw = null;
  if (insufficientMaterial(board)) draw = 'insufficient_material';
  else if (repetitions >= 5) draw = 'fivefold_repetition';
  else if (getBoardState(board).halfmove >= 150) draw = 'seventy_five_moves';
  else if (claimDraw && repetitions >= 3) draw = 'threefold_repetition';
  else if (claimDraw && getBoardState(board).halfmove >= 100)
    draw = 'fifty_moves';
  return { winner: null, draw, check };
}
export function getTimeoutOutcome(board, timedOutWhite) {
  const winningWhite = !timedOutWhite;
  const hasPiece = board.some((row) =>
    row.some((p) => p && p.w === winningWhite && p.t !== 'K')
  );
  return !hasPiece || insufficientMaterial(board)
    ? { winner: null, draw: 'insufficient_material', resultReason: 'timeout' }
    : {
        winner: winningWhite ? 'white' : 'black',
        draw: null,
        resultReason: 'timeout'
      };
}
export const DRAW_LABELS = {
  stalemate: 'Stalemate',
  insufficient_material: 'Draw — insufficient material',
  fivefold_repetition: 'Draw — fivefold repetition',
  seventy_five_moves: 'Draw — 75-move rule',
  threefold_repetition: 'Draw — threefold repetition',
  fifty_moves: 'Draw — 50-move rule'
};
