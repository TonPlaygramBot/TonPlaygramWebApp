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

  movePiece(playerIdx, from, to) {
    const piece = this.pieceAt(from);
    if (!piece || piece.player !== playerIdx) return false;
    if (this.pieceAt(to)) return false;
    const dr = to.row - from.row;
    const dc = Math.abs(to.col - from.col);
    if (Math.abs(dr) !== 1 || dc !== 1) return false;
    if (!piece.king && dr !== (playerIdx === 0 ? 1 : -1)) return false;
    this.board[to.row][to.col] = piece;
    this.board[from.row][from.col] = null;
    if ((playerIdx === 0 && to.row === 7) || (playerIdx === 1 && to.row === 0)) {
      piece.king = true;
    }
    this.currentTurn = (this.currentTurn + 1) % this.players.length;
    return true;
  }
}
