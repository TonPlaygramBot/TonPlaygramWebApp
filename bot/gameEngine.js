import GameResult from "./models/GameResult.js";
export const FINAL_TILE = 101;
export const DEFAULT_SNAKES = { 99: 80 };
export const DEFAULT_LADDERS = { 3: 22, 27: 46 };
export const ROLL_COOLDOWN_MS = 1000;
export const RECONNECT_GRACE_MS = 60000;
export const GAME_START_DELAY_MS = 5000;
import { SnakeGame } from './logic/snakeGame.js';
import { CheckersGame } from './logic/checkersGame.js';

import GameRoomModel from './models/GameRoom.js';

function toNumberSet(values) {
  return new Set(values.map((v) => Number(v)));
}

function generateDiceCells(snakes, ladders) {
  const boardSize = FINAL_TILE - 1;
  const diceValues = [1, 2, 1];
  const diceCells = {};
  const used = toNumberSet([
    ...Object.keys(snakes || {}),
    ...Object.values(snakes || {}),
    ...Object.keys(ladders || {}),
    ...Object.values(ladders || {})
  ]);

  const isCellBlocked = (cell) =>
    used.has(cell) ||
    diceCells[cell] != null ||
    cell <= 1 ||
    cell >= FINAL_TILE;

  for (const value of diceValues) {
    let attempts = 0;
    let cell;
    do {
      cell = Math.floor(Math.random() * boardSize) + 1;
      attempts += 1;
      if (attempts > boardSize * 3) break;
    } while (isCellBlocked(cell));
    if (!isCellBlocked(cell)) {
      diceCells[cell] = value;
      used.add(cell);
    }
  }

  return diceCells;
}

function normalizeDiceCells(cells = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(cells)) {
    const cell = Number(key);
    if (!Number.isFinite(cell)) continue;
    const val = Number(value);
    if (!Number.isFinite(val)) continue;
    normalized[cell] = val;
  }
  return normalized;
}

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
    if (used.has(start) || used.has(end) || snakes[start] || end === 1) continue;
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
  const diceCells = generateDiceCells(snakes, ladders);
  return { snakes, ladders, diceCells };
}

export class GameRoom {
  constructor(id, io, capacity = 4, board = {}, gameType = 'snake') {
    this.id = id;
    this.io = io;
    this.capacity = capacity;
    this.gameType = gameType;
    this.currentTurn = 0;
    this.status = 'waiting';
    if (this.gameType === 'snake') {
      if (board.snakes && board.ladders) {
        this.snakes = board.snakes;
        this.ladders = board.ladders;
        this.diceCells = normalizeDiceCells(board.diceCells);
      } else {
        const b = generateBoard();
        this.snakes = b.snakes;
        this.ladders = b.ladders;
        this.diceCells = normalizeDiceCells(b.diceCells);
      }
      if (!this.diceCells) this.diceCells = {};
      this.initialDiceCells = { ...this.diceCells };
    }
    this.rollCooldown = ROLL_COOLDOWN_MS;
    this.reconnectGrace = RECONNECT_GRACE_MS;
    this.gameStartDelay = GAME_START_DELAY_MS;
    this.turnTimer = null;
    this.startTimer = null;
    this.cheatWarnings = {};
    if (this.gameType === 'snake') {
      this.game = new SnakeGame({
        snakes: this.snakes,
        ladders: this.ladders,
        diceCells: { ...this.diceCells }
      });
    } else {
      this.game = new CheckersGame();
    }
    this.players = this.game.players;
  }

  addPlayer(playerId, name, socket, avatar = '') {
    const existing = this.players.find((p) => p.playerId === playerId);
    if (existing) {
      existing.socketId = socket.id;
      existing.name = name || existing.name;
      if (avatar) existing.avatar = avatar;
      existing.disconnected = false;
      if (existing.disconnectTimer) {
        clearTimeout(existing.disconnectTimer);
        existing.disconnectTimer = null;
        this.io.to(this.id).emit('playerRejoined', { playerId });
      }
    } else {
      if (this.players.length >= this.capacity || this.status !== 'waiting') {
        return { error: 'Room full or game already started' };
      }
      this.game.addPlayer(playerId, name);
      const player = this.game.players[this.game.players.length - 1];
      player.playerId = playerId;
      player.socketId = socket.id;
      player.disconnected = false;
      player.lastRollTime = 0;
      player.disconnectTimer = null;
      player.avatar = avatar || '';
    }
    socket.join(this.id);
    const list = this.players.filter((p) => !p.disconnected).map((p) => ({
      playerId: p.playerId,
      name: p.name,
      position: p.position,
      avatar: p.avatar || ''
    }));
    socket.emit('currentPlayers', list);
    this.io.to(this.id).emit('currentPlayers', list);
    if (!existing) {
      this.io.to(this.id).emit('playerJoined', { playerId, name });
      if (this.players.length === this.capacity) {
        if (this.startTimer) clearTimeout(this.startTimer);
        this.io.to(this.id).emit('gameStarting', { startIn: this.gameStartDelay });
        this.startTimer = setTimeout(() => {
          this.startTimer = null;
          this.startGame();
        }, this.gameStartDelay);
        if (this.startTimer?.unref) this.startTimer.unref();
      }
    } else if (this.status === 'playing') {
      socket.emit('gameStarted');
      this.emitNextTurn();
    }
    return {
      success: true,
      board:
        this.gameType === 'snake'
          ? { snakes: this.snakes, ladders: this.ladders, diceCells: this.diceCells }
          : this.gameType === 'checkers'
          ? { board: this.game.board }
          : undefined
    };
  }

  startGame() {
    if (this.status !== 'waiting') return;
    if (this.startTimer) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }
    // The board is generated when the room is created and should remain
    // consistent for all players. Do not regenerate it here.
    if (this.gameType === 'snake') {
      this.game.snakes = this.snakes;
      this.game.ladders = this.ladders;
      this.diceCells = { ...this.initialDiceCells };
      this.game.diceCells = { ...this.diceCells };
    }
    this.game.currentTurn = 0;
    this.game.finished = false;
    if (this.gameType === 'snake') {
      this.players.forEach((p) => {
        p.position = 0;
        p.diceCount = 2;
        p.isActive = false;
      });
    }
    this.status = 'playing';
    this.currentTurn = 0;
    this.io.to(this.id).emit('gameStarted');
    this.emitNextTurn();
  }

  emitNextTurn() {
    const current = this.players[this.currentTurn];
    if (current) {
      this.io.to(this.id).emit('turnChanged', { playerId: current.playerId });
      if (this.turnTimer) clearTimeout(this.turnTimer);
      this.turnTimer = setTimeout(() => {
        if (
          this.status === 'playing' &&
          this.players[this.currentTurn] === current &&
          !current.disconnected
        ) {
          const sock = { id: current.socketId, emit: () => {} };
          this.rollDice(sock);
        }
      }, 15000);
      if (this.turnTimer?.unref) this.turnTimer.unref();
    }
  }

  applySnakesAndLadders(pos) {
    if (this.snakes[pos]) return this.snakes[pos];
    if (this.ladders[pos]) return this.ladders[pos];
    return pos;
  }

  warnCheat(player, socket, reason) {
    const id = player.playerId;
    this.cheatWarnings[id] = (this.cheatWarnings[id] || 0) + 1;
    socket.emit('cheatWarning', {
      playerId: id,
      reason,
      count: this.cheatWarnings[id]
    });
    if (this.cheatWarnings[id] >= 3) {
      this.handleDisconnect(socket);
    }
  }

  rollDice(socket, value) {
    if (this.status !== 'playing') return;
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    const playerIndex = this.players.findIndex((p) => p.socketId === socket.id);
    if (playerIndex === -1) return;
    const player = this.players[playerIndex];
    if (this.players[this.currentTurn].socketId !== socket.id) {
      this.warnCheat(player, socket, 'not your turn');
      return;
    }

    if (Date.now() - player.lastRollTime < this.rollCooldown) {
      socket.emit('error', 'roll cooldown');
      this.warnCheat(player, socket, 'roll cooldown');
      return;
    }
    player.lastRollTime = Date.now();

    const prevPositions = this.players.map((p) => p.position);

    if (this.gameType === 'snake') {
      const result = this.game.rollDice(value != null ? [value] : undefined);
      if (!result) return;

      const total = result.dice.reduce((a, b) => a + b, 0);
      this.io.to(this.id).emit('diceRolled', { playerId: player.playerId, value: total });
      const from = prevPositions[playerIndex];
      const to = result.path.length ? result.path[result.path.length - 1] : from;

      if (to !== from) {
        this.io.to(this.id).emit('movePlayer', { playerId: player.playerId, from, to });
        if (result.position !== to) {
          this.io.to(this.id).emit('snakeOrLadder', { playerId: player.playerId, from: to, to: result.position });
        }
      }

      this.players.forEach((p, idx) => {
        if (idx !== playerIndex && prevPositions[idx] !== 0 && p.position === 0) {
          this.io.to(this.id).emit('playerReset', { playerId: p.playerId });
        }
      });

      this.diceCells = { ...this.game.diceCells };
      if (result.bonusCell != null) {
        this.io.to(this.id).emit('diceCellsUpdate', {
          diceCells: this.diceCells,
          playerId: player.playerId,
          cell: result.bonusCell,
          value: result.bonus
        });
      }

      if (result.finished) {
        this.status = 'finished';
        GameResult.create({
          winner: player.name,
          participants: this.players.map((p) => p.name)
        }).catch((err) =>
          console.error('Failed to store game result:', err.message)
        );
        this.io.to(this.id).emit('gameWon', { playerId: player.playerId });
        return;
      }

      this.currentTurn = this.game.currentTurn;
    } else {
      const result = this.game.rollDice(value);
      if (!result) return;
      this.io.to(this.id).emit('diceRolled', { playerId: player.playerId, value: result.dice });
      if (result.token !== -1) {
        this.io.to(this.id).emit('moveToken', {
          playerId: player.playerId,
          token: result.token,
          position: result.position
        });
      }
      if (result.finished) {
        this.status = 'finished';
        this.io.to(this.id).emit('gameWon', { playerId: player.playerId });
        return;
      }
      this.currentTurn = this.game.currentTurn;
    }
    this.emitNextTurn();
  }

  handleDisconnect(socket) {
    const idx = this.players.findIndex((p) => p.socketId === socket.id);
    if (idx === -1) return;
    const player = this.players[idx];
    player.disconnected = true;
    player.socketId = null;
    this.io.to(this.id).emit('playerDisconnected', { playerId: player.playerId });
    if (this.status === 'waiting' && this.startTimer) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }
    if (idx === this.currentTurn) {
      if (this.turnTimer) {
        clearTimeout(this.turnTimer);
        this.turnTimer = null;
      }
      do {
        this.currentTurn = (this.currentTurn + 1) % this.players.length;
      } while (this.players[this.currentTurn].disconnected && this.players.some((p) => !p.disconnected));
      if (this.players.some((p) => !p.disconnected)) this.emitNextTurn();
    }
    player.disconnectTimer = setTimeout(() => {
      this.finalizeDisconnect(player);
    }, this.reconnectGrace);
    if (player.disconnectTimer?.unref) player.disconnectTimer.unref();
  }

  finalizeDisconnect(player) {
    if (!player.disconnected) return;
    if (this.gameType === 'snake') {
      player.position = 0;
    }
    player.disconnectTimer = null;
    this.io.to(this.id).emit('playerLeft', { playerId: player.playerId });
    if (this.status === 'playing') {
      const active = this.players.filter((p) => !p.disconnected);
      if (active.length === 1) {
        const winner = active[0];
        this.status = 'finished';
        GameResult.create({
          winner: winner.name,
          participants: this.players.map((p) => p.name),
        }).catch((err) =>
          console.error('Failed to store game result:', err.message)
        );
        this.io.to(this.id).emit('gameWon', { playerId: winner.playerId });
        return;
      }
    }
    GameRoomModel.findOneAndUpdate(
      { roomId: this.id },
      {
        players: this.players.map((p) => ({
          playerId: p.playerId,
          name: p.name,
          position: p.position,
          isActive: p.isActive,
          disconnected: p.disconnected
        })),
        status: this.status,
        currentTurn: this.currentTurn,
        snakes: this.snakes,
        ladders: this.ladders,
        diceCells: this.diceCells
      },
      { upsert: true }
    ).catch(() => {});
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
        ladders: Object.fromEntries(doc.ladders),
        diceCells: Object.fromEntries(doc.diceCells || [])
      }, doc.gameType || 'snake');
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
      gameType: room.gameType,
      status: room.status,
      currentTurn: room.currentTurn,
      snakes: room.snakes,
      ladders: room.ladders,
      diceCells: room.diceCells,
      players: room.players.map((p) => ({
        playerId: p.playerId,
        name: p.name,
        position: p.position,
        isActive: p.isActive,
        disconnected: p.disconnected
      }))
    };
    await GameRoomModel.findOneAndUpdate({ roomId: room.id }, doc, {
      upsert: true
    });
  }

  async getRoom(id, capacity = 4, board, gameType) {
    let room = this.rooms.get(id);
    if (!room) {
      const record = await GameRoomModel.findOne({ roomId: id });
      if (record) {
        room = new GameRoom(id, this.io, record.capacity, {
          snakes: Object.fromEntries(record.snakes),
          ladders: Object.fromEntries(record.ladders),
          diceCells: Object.fromEntries(record.diceCells || [])
        }, record.gameType || 'snake');
        room.players = record.players.map((p) => ({
          ...p.toObject(),
          socketId: null,
          lastRollTime: 0
        }));
        room.currentTurn = record.currentTurn;
        room.status = record.status;
      } else {
        const type =
          gameType ||
          (id.startsWith('checkers') ? 'checkers' : 'snake');
        room = new GameRoom(id, this.io, capacity, board, type);
        await GameRoomModel.updateOne(
          { roomId: id },
          {
            roomId: id,
            capacity: room.capacity,
            gameType: room.gameType,
            status: room.status,
            currentTurn: room.currentTurn,
            snakes: room.snakes,
            ladders: room.ladders,
            diceCells: room.diceCells,
            players: []
          },
          { upsert: true }
        );
      }
      this.rooms.set(id, room);
    }
    return room;
  }

  async joinRoom(roomId, playerId, name, socket, avatar = '') {
    const match = /-(\d+)$/.exec(roomId);
    const cap = match ? Number(match[1]) : 4;
    const room = await this.getRoom(roomId, cap);
    const result = room.addPlayer(playerId, name, socket, avatar);
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
