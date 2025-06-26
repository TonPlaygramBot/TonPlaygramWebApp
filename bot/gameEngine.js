import GameResult from "./models/GameResult.js";
export const FINAL_TILE = 101;
export const DEFAULT_SNAKES = { 99: 80 };
export const DEFAULT_LADDERS = { 3: 22, 27: 46 };
export const ROLL_COOLDOWN_MS = 1000;
export const TURN_DELAY_MS = 6000;

import GameRoomModel from './models/GameRoom.js';

function generateBoard() {
  const boardSize = FINAL_TILE - 1;
  const snakeCount = 6 + Math.floor(Math.random() * 3);
  const ladderCount = 6 + Math.floor(Math.random() * 3);
  const snakes = {};
  const used = new Set();
  while (Object.keys(snakes).length < snakeCount) {
    const start = Math.floor(Math.random() * (boardSize - 10)) + 10;
    const maxDrop = Math.min(start - 1, 20);
    if (maxDrop <= 0) continue;
    const end = start - (Math.floor(Math.random() * maxDrop) + 1);
    if (used.has(start) || used.has(end) || snakes[start]) continue;
    snakes[start] = end;
    used.add(start);
    used.add(end);
  }
  const ladders = {};
  const usedL = new Set([...used]);
  while (Object.keys(ladders).length < ladderCount) {
    const start = Math.floor(Math.random() * (boardSize - 20)) + 2;
    const max = Math.min(boardSize - start - 1, 20);
    if (max < 1) continue;
    const end = start + (Math.floor(Math.random() * max) + 1);
    if (
      usedL.has(start) ||
      usedL.has(end) ||
      ladders[start] ||
      Object.values(ladders).includes(end)
    )
      continue;
    ladders[start] = end;
    usedL.add(start);
    usedL.add(end);
  }
  return { snakes, ladders };
}

export class GameRoom {
  constructor(id, io, capacity = 4, board = {}) {
    this.id = id;
    this.io = io;
    this.capacity = capacity;
    this.players = [];
    this.currentTurn = 0;
    this.status = 'waiting';
    if (board.snakes && board.ladders) {
      this.snakes = board.snakes;
      this.ladders = board.ladders;
    } else {
      const b = generateBoard();
      this.snakes = b.snakes;
      this.ladders = b.ladders;
    }
    this.rollCooldown = ROLL_COOLDOWN_MS;
    this.turnDelay = TURN_DELAY_MS;
    this.turnLock = false;
  }

  addPlayer(playerId, name, socket) {
    if (this.players.length >= this.capacity || this.status !== 'waiting') {
      return { error: 'Room full or game already started' };
    }
    const player = {
      index: this.players.length,
      playerId,
      name,
      position: 0,
      isActive: false,
      socketId: socket.id,
      disconnected: false,
      lastRollTime: 0
    };
    this.players.push(player);
    socket.join(this.id);
    this.io.to(this.id).emit('playerJoined', { playerId, name, index: player.index });
    if (this.players.length === this.capacity) {
      this.startGame();
    }
    return { success: true };
  }

  startGame() {
    if (this.status !== 'waiting') return;
    this.status = 'playing';
    this.currentTurn = 0;
    this.turnLock = false;
    this.io.to(this.id).emit('gameStarted');
    this.emitNextTurn();
  }

  emitNextTurn() {
    const current = this.players[this.currentTurn];
    if (current) {
      this.io.to(this.id).emit('turnChanged', { playerId: current.playerId, index: current.index });
    }
  }

  applySnakesAndLadders(pos) {
    if (this.snakes[pos]) return this.snakes[pos];
    if (this.ladders[pos]) return this.ladders[pos];
    return pos;
  }

  rollDice(socket, value) {
    if (this.status !== 'playing' || this.turnLock) return;
    const playerIndex = this.players.findIndex((p) => p.socketId === socket.id);
    if (playerIndex === -1) return;
    const player = this.players[playerIndex];
    if (this.players[this.currentTurn].socketId !== socket.id) return;

    if (Date.now() - player.lastRollTime < this.rollCooldown) {
      socket.emit('error', 'roll cooldown');
      return;
    }
    player.lastRollTime = Date.now();
    this.turnLock = true;

    const dice = value ?? Math.floor(Math.random() * 6) + 1;
    if (typeof socket.emit === 'function') {
      socket.emit('diceRolled', { playerId: player.playerId, index: player.index, value: dice });
    }

    let from = player.position;
    let to = player.position;

      if (!player.isActive) {
        if (dice === 6) {
          player.isActive = true;
          to = from + 1;
        }
      } else {
        if (from + dice <= FINAL_TILE) {
          to = from + dice;
        }
    }

    if (to !== from) {
        player.position = to;
        this.io.to(this.id).emit('movePlayer', { playerId: player.playerId, index: player.index, from, to });
        const final = this.applySnakesAndLadders(to);
        if (final !== to) {
          player.position = final;
          this.io.to(this.id).emit('snakeOrLadder', { playerId: player.playerId, index: player.index, from: to, to: final });
        }
    }

    // If a player lands on another, that opponent returns to start and must
    // roll a six again to become active. This reinstates the classic capture
    // mechanic removed in the simplified mode.
    if (player.position !== 0) {
      for (const opp of this.players) {
        if (
          opp !== player &&
          opp.isActive &&
          opp.position === player.position &&
          opp.position !== 0
        ) {
          opp.position = 0;
          opp.isActive = false;
          this.io.to(this.id).emit('playerReset', {
            playerId: opp.playerId,
            index: opp.index
          });
        }
      }
    }


    if (player.position === FINAL_TILE) {
      this.status = 'finished';
      GameResult.create({
        winner: player.name,
        participants: this.players.map((p) => p.name)
      }).catch((err) =>
        console.error('Failed to store game result:', err.message)
      );
      this.io.to(this.id).emit('gameWon', { playerId: player.playerId, index: player.index });
      this.turnLock = false;
      return;
    }

    do {
      this.currentTurn = (this.currentTurn + 1) % this.players.length;
    } while (this.players[this.currentTurn].disconnected);

    const unlock = () => {
      this.turnLock = false;
      this.emitNextTurn();
    };
    if (this.turnDelay === 0) {
      unlock();
    } else {
      setTimeout(unlock, this.turnDelay);
    }
  }

  handleDisconnect(socket) {
    const idx = this.players.findIndex((p) => p.socketId === socket.id);
    if (idx === -1) return;
    const player = this.players[idx];
    player.disconnected = true;
    this.io.to(this.id).emit('playerLeft', { playerId: player.playerId, index: player.index });
    if (this.status === 'playing' && idx === this.currentTurn) {
      if (this.players.some((p) => !p.disconnected)) {
        do {
          this.currentTurn = (this.currentTurn + 1) % this.players.length;
        } while (this.players[this.currentTurn].disconnected);
        this.turnLock = false;
        this.emitNextTurn();
      }
    }
  }
}

export class GameRoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  async loadRooms() {
    const docs = await GameRoomModel.find({});
    for (const doc of docs) {
      const room = new GameRoom(doc.roomId, this.io, doc.capacity, {
        snakes: Object.fromEntries(doc.snakes),
        ladders: Object.fromEntries(doc.ladders)
      });
      room.players = doc.players.map((p) => ({
        ...p.toObject(),
        socketId: null,
        lastRollTime: 0
      }));
      room.currentTurn = doc.currentTurn;
      room.status = doc.status;
      this.rooms.set(room.id, room);
    }
  }

  async saveRoom(room) {
    const doc = {
      roomId: room.id,
      capacity: room.capacity,
      status: room.status,
      currentTurn: room.currentTurn,
      snakes: room.snakes,
      ladders: room.ladders,
      players: room.players.map((p) => ({
        playerId: p.playerId,
        name: p.name,
        index: p.index,
        position: p.position,
        isActive: p.isActive,
        disconnected: p.disconnected
      }))
    };
    await GameRoomModel.findOneAndUpdate({ roomId: room.id }, doc, {
      upsert: true
    });
  }

  async getRoom(id, capacity = 4, board) {
    let room = this.rooms.get(id);
    if (!room) {
      const record = await GameRoomModel.findOne({ roomId: id });
      if (record) {
        room = new GameRoom(id, this.io, record.capacity, {
          snakes: Object.fromEntries(record.snakes),
          ladders: Object.fromEntries(record.ladders)
        });
        room.players = record.players.map((p, idx) => ({
          ...p.toObject(),
          index: p.index ?? idx,
          socketId: null,
          lastRollTime: 0
        }));
        room.currentTurn = record.currentTurn;
        room.status = record.status;
      } else {
        room = new GameRoom(id, this.io, capacity, board);
        await GameRoomModel.create({
          roomId: id,
          capacity: room.capacity,
          status: room.status,
          currentTurn: room.currentTurn,
          snakes: room.snakes,
          ladders: room.ladders,
          players: []
        });
      }
      this.rooms.set(id, room);
    }
    return room;
  }

  async joinRoom(roomId, playerId, name, socket) {
    const match = /-(\d+)$/.exec(roomId);
    const cap = match ? Number(match[1]) : 4;
    const room = await this.getRoom(roomId, cap);
    const result = room.addPlayer(playerId, name, socket);
    if (!result.error) await this.saveRoom(room);
    return result;
  }

  async rollDice(socket) {
    const room = this.findRoomBySocket(socket.id);
    if (room) {
      room.rollDice(socket);
      await this.saveRoom(room);
    }
  }

  async handleDisconnect(socket) {
    const room = this.findRoomBySocket(socket.id);
    if (room) {
      room.handleDisconnect(socket);
      await this.saveRoom(room);
      if (room.players.every((p) => p.disconnected)) {
        this.rooms.delete(room.id);
        await GameRoomModel.deleteOne({ roomId: room.id });
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
