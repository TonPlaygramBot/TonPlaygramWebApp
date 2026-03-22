export class CheckersGame {
  constructor() {
    this.players = [];
    this.board = this.#initBoard();
    this.currentTurn = 0;
    this.finished = false;
  }

  #initBoard() {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    // Player 0 pieces (top of board)
    for (let row = 0; row < 3; row++) {
      for (let col = (row + 1) % 2; col < 8; col += 2) {
        board[row][col] = { player: 0, king: false };
      }
    }
    // Player 1 pieces (bottom of board)
    for (let row = 5; row < 8; row++) {
      for (let col = (row + 1) % 2; col < 8; col += 2) {
        board[row][col] = { player: 1, king: false };
      }
    }
    return board;
  }

  addPlayer(id, name) {
    if (this.players.length >= 2) return;
    this.players.push({ id, name });
  }

  pieceAt({ row, col }) {
    if (row < 0 || row > 7 || col < 0 || col > 7) return null;
    return this.board[row][col];
  }

  #countPieces(playerIdx) {
    let count = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece?.player === playerIdx) count += 1;
      }
    }
    return count;
  }

  #normalizeCell(cell) {
    if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.col)) {
      return null;
    }
    if (cell.row < 0 || cell.row > 7 || cell.col < 0 || cell.col > 7) {
      return null;
    }
    return { row: cell.row, col: cell.col };
  }

  #isForwardMove(piece, playerIdx, dr) {
    if (piece.king) return true;
    return dr === (playerIdx === 0 ? 1 : -1);
  }

  movePiece(playerIdx, from, to) {
    if (this.finished) return { ok: false, error: 'game_finished' };
    if (this.currentTurn !== playerIdx) return { ok: false, error: 'not_your_turn' };
    const fromCell = this.#normalizeCell(from);
    const toCell = this.#normalizeCell(to);
    if (!fromCell || !toCell) return { ok: false, error: 'invalid_cell' };

    const piece = this.pieceAt(fromCell);
    if (!piece || piece.player !== playerIdx) return { ok: false, error: 'invalid_piece' };
    if (this.pieceAt(toCell)) return { ok: false, error: 'target_occupied' };

    const dr = toCell.row - fromCell.row;
    const dc = toCell.col - fromCell.col;
    const absDr = Math.abs(dr);
    const absDc = Math.abs(dc);
    if (absDr !== absDc || (absDr !== 1 && absDr !== 2)) {
      return { ok: false, error: 'invalid_move_shape' };
    }

    let captured = null;
    if (absDr === 1) {
      if (!this.#isForwardMove(piece, playerIdx, dr)) {
        return { ok: false, error: 'invalid_direction' };
      }
    } else if (absDr === 2) {
      if (!piece.king && !this.#isForwardMove(piece, playerIdx, dr / 2)) {
        return { ok: false, error: 'invalid_direction' };
      }
      const mid = {
        row: fromCell.row + dr / 2,
        col: fromCell.col + dc / 2
      };
      const jumped = this.pieceAt(mid);
      if (!jumped || jumped.player === playerIdx) {
        return { ok: false, error: 'no_enemy_to_capture' };
      }
      captured = { ...mid, player: jumped.player };
      this.board[mid.row][mid.col] = null;
    }

    this.board[toCell.row][toCell.col] = piece;
    this.board[fromCell.row][fromCell.col] = null;
    let crowned = false;
    if ((playerIdx === 0 && toCell.row === 7) || (playerIdx === 1 && toCell.row === 0)) {
      if (!piece.king) {
        piece.king = true;
        crowned = true;
      }
    }

    const opponentIdx = playerIdx === 0 ? 1 : 0;
    const opponentPieces = this.#countPieces(opponentIdx);
    if (opponentPieces === 0) {
      this.finished = true;
    }

    this.currentTurn = this.players.length > 0 ? (this.currentTurn + 1) % this.players.length : 0;
    return {
      ok: true,
      from: fromCell,
      to: toCell,
      captured,
      crowned,
      nextTurn: this.currentTurn,
      winner: this.finished ? playerIdx : null
    };
  }

  getState() {
    return {
      board: this.board,
      currentTurn: this.currentTurn,
      finished: this.finished
    };
  }
}
