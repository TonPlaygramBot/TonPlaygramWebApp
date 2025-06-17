export const FINAL_TILE = 101;
export const ROLL_COOLDOWN_MS = 1000;

export const DEFAULT_SNAKES = {
  17: 4,
  19: 7,
  21: 9,
  54: 34,
  62: 18,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 79,
  99: 7,
};

export const DEFAULT_LADDERS = {
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

function addWidthsToLadders(ladders) {
  const obj = {};
  for (const [s, e] of Object.entries(ladders)) {
    obj[s] = { end: e, width: 6 + Math.floor(Math.random() * 6) };
  }
  return obj;
}

function generateRandomLadders(snakes, count = 8) {
  const ladders = {};
  const used = new Set([...Object.keys(snakes), ...Object.values(snakes)]);
  while (Object.keys(ladders).length < count) {
    const start = Math.floor(Math.random() * (FINAL_TILE - 20)) + 2;
    const maxStep = Math.min(FINAL_TILE - start - 1, 20);
    if (maxStep < 3) continue;
    const end = start + 3 + Math.floor(Math.random() * maxStep);
    if (used.has(String(start)) || used.has(String(end))) continue;
    if (ladders[start] || Object.values(ladders).some(l => l.end === start || l.end === end)) continue;
    ladders[start] = { end, width: 6 + Math.floor(Math.random() * 6) };
    used.add(String(start));
    used.add(String(end));
  }
  return ladders;
}

export class GameRoom {
  constructor(id, io, maxPlayers = 4, options = {}) {
    this.id = id;
    this.io = io;
    this.maxPlayers = maxPlayers;
    this.players = [];
    this.currentTurn = 0;
    this.status = 'waiting';
    this.rollCooldown = ROLL_COOLDOWN_MS;
    this.snakes = options.snakes || { ...DEFAULT_SNAKES };
    if (options.ladders) {
      this.ladders = addWidthsToLadders(options.ladders);
    } else {
      this.ladders = generateRandomLadders(this.snakes);
    }
  }

  addPlayer(playerId, name, socket) {
    if (this.players.length >= this.maxPlayers || this.status !== 'waiting') {
      return { error: 'Room full or game already started' };
    }
    const player = {
      playerId,
      name,
      position: 0,
      isActive: false,
      socketId: socket.id,
      disconnected: false,
      consecutiveSixes: 0,
      lastRollTime: 0
    };
    this.players.push(player);
    socket.join(this.id);
    this.io.to(this.id).emit('playerJoined', { playerId, name });
    if (this.players.length === this.maxPlayers) {
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
    const ladder = this.ladders[pos];
    if (ladder) return typeof ladder === 'object' ? ladder.end : ladder;
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
      socket.emit('error', 'Rolling too fast');
      return;
    }
    player.lastRollTime = now;

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
      if (from + dice <= FINAL_TILE) {
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

    if (player.position === FINAL_TILE) {
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

  getRoom(id, maxPlayers = 4) {
    let room = this.rooms.get(id);
    if (!room) {
      room = new GameRoom(id, this.io, maxPlayers);
      this.rooms.set(id, room);
    }
    return room;
  }

  joinRoom(roomId, playerId, name, socket) {
    const match = /-(\d+)$/.exec(roomId);
    const maxPlayers = match ? Number(match[1]) : 4;
    const room = this.getRoom(roomId, maxPlayers);
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
