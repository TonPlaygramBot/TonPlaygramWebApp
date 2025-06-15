export class GameRoom {
  constructor(id, io) {
    this.id = id;
    this.io = io;
    this.players = [];
    this.currentTurn = 0;
    this.status = 'waiting';
    this.snakes = {
      17: 4,
      19: 7,
      21: 9,
      27: 1,
      54: 34,
      62: 18,
      64: 60,
      87: 24,
      93: 73,
      95: 75,
      98: 79,
      99: 7,
    };
    this.ladders = {
      3: 22,
      5: 8,
      11: 26,
      20: 29,
      27: 56,
      36: 44,
      51: 67,
      71: 91,
      80: 100,
    };
  }

  addPlayer(playerId, name, socket) {
    if (this.players.length >= 4 || this.status !== 'waiting') {
      return { error: 'Room full or game already started' };
    }
    const player = {
      playerId,
      name,
      position: 0,
      isActive: false,
      socketId: socket.id,
      disconnected: false,
      consecutiveSixes: 0
    };
    this.players.push(player);
    socket.join(this.id);
    this.io.to(this.id).emit('playerJoined', { playerId, name });
    if (this.players.length === 4) {
      this.startGame();
    }
    return { success: true };
  }

  startGame() {
    if (this.status !== 'waiting') return;
    this.status = 'playing';
    this.currentTurn = 0;
    this.io.to(this.id).emit('gameStarted');
    this.emitNextTurn(true);
  }

  emitNextTurn(resetStreak = true) {
    const current = this.players[this.currentTurn];
    if (current) {
      if (resetStreak) current.consecutiveSixes = 0;
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

    const dice = value ?? Math.floor(Math.random() * 6) + 1;
    this.io.to(this.id).emit('diceRolled', { playerId: player.playerId, value: dice });

    let from = player.position;
    let to = player.position;

    if (dice === 6) {
      player.consecutiveSixes += 1;
    } else {
      player.consecutiveSixes = 0;
    }

    if (player.consecutiveSixes === 3) {
      player.consecutiveSixes = 0;
      do {
        this.currentTurn = (this.currentTurn + 1) % this.players.length;
      } while (this.players[this.currentTurn].disconnected);
      this.emitNextTurn(true);
      return;
    }

    if (!player.isActive) {
      if (dice === 6) {
        player.isActive = true;
        to = 1;
      }
    } else {
      if (from + dice <= 100) {
        to = from + dice;
      }
    }

    if (to !== from) {
      player.position = to;
      this.io.to(this.id).emit('movePlayer', { playerId: player.playerId, from, to });
      const final = this.applySnakesAndLadders(to);
      if (final !== to) {
        player.position = final;
        this.io.to(this.id).emit('snakeOrLadder', { playerId: player.playerId, from: to, to: final });
      }
    }

    if (player.position === 100) {
      this.status = 'finished';
      this.io.to(this.id).emit('gameWon', { playerId: player.playerId });
      return;
    }

    const extraTurn = dice === 6 && to !== from;
    if (!extraTurn) {
      do {
        this.currentTurn = (this.currentTurn + 1) % this.players.length;
      } while (this.players[this.currentTurn].disconnected);
      this.emitNextTurn(true);
    } else {
      this.emitNextTurn(false);
    }
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

  getRoom(id) {
    let room = this.rooms.get(id);
    if (!room) {
      room = new GameRoom(id, this.io);
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
