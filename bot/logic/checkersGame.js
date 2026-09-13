import { createInitialBoard, applyAuthoritativeMove, inBounds } from '../../shared/checkersRules.js';

const toLegacy = (board) => board.map((row) => row.map((piece) => piece
  ? { player: piece.side === 'dark' ? 0 : 1, king: piece.king } : null));
export class CheckersGame {
  constructor() {
    this.players = [];
    this.board = toLegacy(createInitialBoard());
    this.currentTurn = 0;
    this.finished = false;
    this.rulesState = {};
  }
  addPlayer(id, name) {
    if (this.players.length >= 2 || this.players.some((player) => player.id === id)) return;
    this.players.push({ id, name });
  }
  pieceAt({ row, col } = {}) {
    return inBounds(row, col) ? this.board[row][col] : null;
  }
  movePiece(playerIdx, from, to) {
    if (this.finished || this.players.length !== 2 || playerIdx !== this.currentTurn) return false;
    const board = this.board.map((row) => row.map((piece) => piece
      ? { side: piece.player === 0 ? 'dark' : 'light', king: piece.king } : null));
    const result = applyAuthoritativeMove({ ...this.rulesState, board, turn: playerIdx === 0 ? 'dark' : 'light' }, {
      from: { r: from?.row, c: from?.col }, to: { r: to?.row, c: to?.col }
    });
    if (!result.ok) return false;
    this.rulesState = result;
    this.board = toLegacy(result.board);
    this.currentTurn = result.turn === 'dark' ? 0 : 1;
    this.finished = Boolean(result.winner || result.draw);
    return true;
  }
}
