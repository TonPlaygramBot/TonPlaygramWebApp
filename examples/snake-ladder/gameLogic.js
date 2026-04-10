export const BOARD_SIZE = 100;

export const DEFAULT_SNAKES = {
  16: 6,
  48: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78
};

export const DEFAULT_LADDERS = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100
};

export class Game {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [];
    this.currentPlayer = 0;
    this.diceRoll = null;
    this.snakes = { ...DEFAULT_SNAKES };
    this.ladders = { ...DEFAULT_LADDERS };
    this.winner = null;
  }

  addPlayer(id, name) {
    if (this.players.length >= 4) return null;
    const existing = this.players.find((p) => p.id === id);
    if (existing) return existing;
    const player = { id, name, position: 0 };
    this.players.push(player);
    return player;
  }

  removePlayer(id) {
    const index = this.players.findIndex((p) => p.id === id);
    if (index === -1) return false;
    this.players.splice(index, 1);
    if (this.players.length === 0) {
      this.currentPlayer = 0;
      this.winner = null;
    } else {
      if (this.currentPlayer >= this.players.length) {
        this.currentPlayer = 0;
      }
      if (this.winner === id) {
        this.winner = null;
      }
    }
    return true;
  }

  rollDice(playerId) {
    if (this.winner) return;
    const current = this.players[this.currentPlayer];
    if (!current || current.id !== playerId) return;
    const value = Math.floor(Math.random() * 6) + 1;
    this.diceRoll = value;
    let newPos = current.position + value;
    if (newPos > BOARD_SIZE) newPos = current.position;
    newPos = this.snakes[newPos] || this.ladders[newPos] || newPos;
    current.position = newPos;
    if (newPos === BOARD_SIZE) {
      this.winner = current.id;
    } else {
      this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    }
  }

  getState() {
    return {
      roomId: this.roomId,
      players: this.players,
      currentPlayer: this.currentPlayer,
      diceRoll: this.diceRoll,
      snakes: this.snakes,
      ladders: this.ladders,
      winner: this.winner
    };
  }
}
