export const FINAL_TILE = 100;
export const DEFAULT_SNAKES = { 99: 80 };
export const DEFAULT_LADDERS = { 3: 22, 27: 46 };

export class GameRoom {
  constructor(id, io, capacity = 4, opts = {}) {
    this.id = id;
    this.io = io;
    this.capacity = capacity;
    this.players = [];
    this.currentTurn = 0;
    this.status = 'waiting';
    this.snakes = opts.snakes || DEFAULT_SNAKES;
    this.ladders = opts.ladders || DEFAULT_LADDERS;
    this.rollCooldown = opts.rollCooldown || 0;
  }

  addPlayer(playerId, name, socket) {
    if (this.players.length >= this.capacity || this.status !== 'waiting') {
      return { error: 'Room full or game already started' };
    }
    const player = {
      playerId,
      name,
      position: 0,
      isActive: false,
      socketId: socket.id,
      disconnected: false,
      lastRollTime: 0,
      consecutiveSixes: 0
    };
    this.players.push(player);
    socket.join(this.id);
    this.io.to(this.id).emit('playerJoined', { playerId, name });
    if (this.players.length === this.capacity) {
      this.startGame();
    }
    return { success: true };
  }

  startGame() {
    if (this.status !== 'waiting') return;
    this.status = 'playing';
    this.currentTurn = 0;
    this.io.to(this.id).emit('gameStarted');
    this.emitNextTurn();
  }

  emitNextTurn() {
    const current = this.players[this.currentTurn];
    if (current) {
      this.io.to(this.id).emit('nextTurn', { playerId: current.playerId });
    }
  }

  applySnakesAndLadders(pos) {
    if (this.snakes[pos]) return this.snakes[pos];
    if (this.ladders[pos]) return this.ladders[pos];
    return pos;
  }

  rollDice(socket, value) {
    if (this.status !== 'playing') return;
    const playerIndex = this.players.findIndex((p) => p.socketId === socket.id);
    if (playerIndex === -1) return;
    const player = this.players[playerIndex];
    if (this.players[this.currentTurn].socketId !== socket.id) return;

    const now = Date.now();
    if (now - player.lastRollTime < this.rollCooldown) {
      if (socket.emit) socket.emit('error', { message: 'roll cooldown' });
      return;
    }
    player.lastRollTime = now;

    const dice = value ?? Math.floor(Math.random() * 6) + 1;
    this.io.to(this.id).emit('diceRolled', { playerId: player.playerId, value: dice });

    let from = player.position;
    let to = player.position;

    if (!player.isActive) {
      if (dice === 6) {
        player.isActive = true;
        to = 1;
      }
    } else if (from + dice <= FINAL_TILE) {
      to = from + dice;
    }

    if (dice === 6) {
      player.consecutiveSixes += 1;
    } else {
      player.consecutiveSixes = 0;
    }

    let skipTurn = false;
    if (player.consecutiveSixes === 3) {
      to = from; // skip move
      player.consecutiveSixes = 0;
      skipTurn = true;
    }

    if (to !== from) {
      player.position = to;
      this.io.to(this.id).emit('movePlayer', { playerId: player.playerId, from, to });
      const final = this.applySnakesAndLadders(to);
      if (final !== to) {
        player.position = final;
        this.io.to(this.id).emit('snakeOrLadder', { playerId: player.playerId, from: to, to: final });
      }

      // capture other players
      for (const other of this.players) {
        if (other !== player && !other.disconnected && other.position === player.position) {
          other.position = 0;
          other.isActive = false;
          other.consecutiveSixes = 0;
          this.io.to(this.id).emit('playerReset', { playerId: other.playerId });
        }
      }
    }

    if (player.position === FINAL_TILE) {
      this.status = 'finished';
      this.io.to(this.id).emit('gameWon', { playerId: player.playerId });
      return;
    }

    if (dice !== 6 || skipTurn) {
      do {
        this.currentTurn = (this.currentTurn + 1) % this.players.length;
      } while (this.players[this.currentTurn].disconnected);
    }
    this.emitNextTurn();
  }

  handleDisconnect(socket) {
    const idx = this.players.findIndex((p) => p.socketId === socket.id);
    if (idx === -1) return;
    const player = this.players[idx];
    player.disconnected = true;
    this.io.to(this.id).emit('playerLeft', { playerId: player.playerId });
  }
}

export class GameRoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  getRoom(id, capacity = 4, opts = {}) {
    let room = this.rooms.get(id);
    if (!room) {
      room = new GameRoom(id, this.io, capacity, opts);
      this.rooms.set(id, room);
    }
    return room;
  }

  joinRoom(roomId, playerId, name, socket) {
    const room = this.getRoom(roomId);
    return room.addPlayer(playerId, name, socket);
  }

  rollDice(socket) {
    const room = this.findRoomBySocket(socket.id);
    if (room) room.rollDice(socket);
  }

  handleDisconnect(socket) {
    const room = this.findRoomBySocket(socket.id);
    if (room) {
      room.handleDisconnect(socket);
      if (room.players.every((p) => p.disconnected)) {
        this.rooms.delete(room.id);
      }
    }
  }

  findRoomBySocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.socketId === socketId)) return room;
    }
    return null;
  }
}
