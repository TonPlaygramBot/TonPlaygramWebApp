import { EventEmitter } from 'events';

export const snakes = { 99: 41, 85: 58, 70: 55 };
export const ladders = { 2: 38, 15: 26, 22: 58 };

export class GameRoom extends EventEmitter {
  constructor(id) {
    super();
    this.id = id;
    this.players = [];
    this.status = 'waiting';
    this.turnIndex = 0;
  }

  addPlayer({ id, name }) {
    if (this.players.length >= 4) throw new Error('room full');
    if (this.players.some((p) => p.id === id)) return;
    const player = { id, name, position: 0, isActive: false, disconnected: false };
    this.players.push(player);
    this.emit('playerJoined', { playerId: id, name });
    if (this.players.length === 4) this.startGame();
  }

  startGame() {
    this.status = 'playing';
    this.turnIndex = 0;
    this.emit('gameStart', {
      players: this.players.map((p) => ({ id: p.id, name: p.name })),
    });
    this.emit('nextTurn', { playerId: this.players[this.turnIndex].id });
  }

  removePlayer(id) {
    const player = this.players.find((p) => p.id === id);
    if (!player) return;
    player.disconnected = true;
    this.emit('playerLeft', { playerId: id });
  }

  get currentPlayer() {
    return this.players[this.turnIndex];
  }

  rollDice(playerId) {
    if (this.status !== 'playing') return;
    const player = this.currentPlayer;
    if (!player || player.id !== playerId) return;

    const value = Math.floor(Math.random() * 6) + 1;
    this.emit('diceRolled', { playerId, value });

    let from = player.position;
    let to = from;

    if (player.isActive || value === 6) {
      if (!player.isActive) player.isActive = true;
      if (from + value <= 100) {
        to = from + value;
        let final = to;
        if (ladders[final]) final = ladders[final];
        if (snakes[final]) final = snakes[final];
        player.position = final;
        this.emit('movePlayer', { playerId, from, to: final });
        if (final !== to) this.emit('snakeOrLadder', { playerId, from: to, to: final });
        if (final === 100) {
          this.status = 'finished';
          this.emit('gameWon', { playerId });
          return;
        }
      }
    }

    if (value !== 6 && this.status === 'playing') {
      this.advanceTurn();
    } else if (this.status === 'playing') {
      this.emit('nextTurn', { playerId: this.currentPlayer.id });
    }
  }

  advanceTurn() {
    do {
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
    } while (this.players[this.turnIndex].disconnected && this.status === 'playing');
    this.emit('nextTurn', { playerId: this.players[this.turnIndex].id });
  }

  getState() {
    return {
      id: this.id,
      status: this.status,
      turn: this.players[this.turnIndex]?.id,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        isActive: p.isActive,
        disconnected: p.disconnected,
      })),
    };
  }
}
