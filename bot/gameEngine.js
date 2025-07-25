import GameResult from "./models/GameResult.js";
export const FINAL_TILE = 101;
export const DEFAULT_SNAKES = { 99: 80 };
export const DEFAULT_LADDERS = { 3: 22, 27: 46 };
export const ROLL_COOLDOWN_MS = 1000;
export const RECONNECT_GRACE_MS = 60000;
// Delay before starting a multiplayer game after the last player joins
// Gives the final player a moment to fully connect and display in the lobby
export const GAME_START_DELAY_MS = 1500;
import { SnakeGame } from './logic/snakeGame.js';
import { LudoGame } from './logic/ludoGame.js';
import generateBoard from './logic/generateBoard.js';

import GameRoomModel from './models/GameRoom.js';
import User from './models/User.js';


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
      } else {
        const b = generateBoard();
        this.snakes = b.snakes;
        this.ladders = b.ladders;
      }
    }
    this.rollCooldown = ROLL_COOLDOWN_MS;
    this.reconnectGrace = RECONNECT_GRACE_MS;
    this.gameStartDelay = GAME_START_DELAY_MS;
    this.turnTimer = null;
    this.startTimer = null;
    this.cheatWarnings = {};
    if (this.gameType === 'snake') {
      this.game = new SnakeGame({ snakes: this.snakes, ladders: this.ladders });
    } else {
      this.game = new LudoGame(this.capacity);
    }
    this.players = this.game.players;
  }

  addPlayer(playerId, name, telegramId, socket) {
    const existing = this.players.find((p) => p.playerId === playerId);
    if (existing) {
      existing.socketId = socket.id;
      existing.name = name || existing.name;
      if (telegramId) existing.telegramId = telegramId;
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
      player.telegramId = telegramId;
      player.socketId = socket.id;
      player.disconnected = false;
      player.lastRollTime = 0;
      player.disconnectTimer = null;
    }
    socket.join(this.id);
    const list = this.players.filter((p) => !p.disconnected).map((p) => ({
      playerId: p.playerId,
      telegramId: p.telegramId,
      name: p.name,
      position: p.position,
    }));
    socket.emit('currentPlayers', list);
    socket.to(this.id).emit('currentPlayers', list);
    if (!existing) {
      socket.to(this.id).emit('playerJoined', { playerId, telegramId, name });
      if (this.players.length === this.capacity) {
        if (this.startTimer) clearTimeout(this.startTimer);
        this.io.to(this.id).emit('gameStarting', { startIn: this.gameStartDelay });
        this.startTimer = setTimeout(() => {
          this.startTimer = null;
          this.startGame();
        }, this.gameStartDelay);
      }
    } else if (this.status === 'playing') {
      socket.emit('gameStarted', {
        snakes: this.snakes,
        ladders: this.ladders
      });
      this.emitNextTurn();
    }
    return { success: true };
  }

  startGame() {
    if (this.status !== 'waiting') return;
    if (this.startTimer) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }
    if (this.gameType === 'snake') {
      // Generate a fresh board for each new game so all players share the
      // same layout while ensuring variety across games.
      const board = generateBoard();
      this.snakes = board.snakes;
      this.ladders = board.ladders;
      this.game.snakes = this.snakes;
      this.game.ladders = this.ladders;
    }
    this.game.currentTurn = 0;
    this.game.finished = false;
    if (this.gameType === 'snake') {
      this.players.forEach((p) => {
        p.position = 0;
        p.diceCount = 2;
        p.isActive = false;
      });
    } else {
      this.players.forEach((p) => {
        p.tokens = Array(4).fill(-1);
        p.finished = 0;
      });
    }
    this.status = 'playing';
    this.currentTurn = 0;
    this.io.to(this.id).emit('gameStarted', {
      snakes: this.snakes,
      ladders: this.ladders
    });
    this.emitNextTurn();
  }

  emitNextTurn() {
    const current = this.players[this.currentTurn];
    if (current) {
      current.lastRollTime = 0; // reset cooldown at the start of every turn
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

      if (result.finished) {
        this.status = 'finished';
        GameResult.create({
          winner: player.name,
          participants: this.players.map((p) => p.name),
          tableId: this.id
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
    this.io.to(this.id).emit('playerDisconnected', {
      playerId: player.playerId,
      telegramId: player.telegramId
    });
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
  }

  finalizeDisconnect(player) {
    if (!player.disconnected) return;
    if (this.gameType === 'snake') {
      player.position = 0;
    } else {
      player.tokens = Array(4).fill(-1);
      player.finished = 0;
    }
    player.disconnectTimer = null;
    this.io.to(this.id).emit('playerLeft', {
      playerId: player.playerId,
      telegramId: player.telegramId
    });
    if (this.status === 'playing') {
      const active = this.players.filter((p) => !p.disconnected);
      if (active.length === 1) {
        const winner = active[0];
        this.status = 'finished';
        GameResult.create({
          winner: winner.name,
          participants: this.players.map((p) => p.name),
          tableId: this.id,
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
          tokens: p.tokens,
          finished: p.finished,
          disconnected: p.disconnected,
        })),
        status: this.status,
        currentTurn: this.currentTurn,
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
        ladders: Object.fromEntries(doc.ladders)
      }, doc.gameType || 'snake');
      room.players = doc.players.map((p) => ({
        ...p.toObject(),
        id: p.playerId,
        socketId: null,
        lastRollTime: 0
      }));
      room.game.players = room.players;
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
      players: room.players.map((p) => ({
        playerId: p.playerId,
        telegramId: p.telegramId,
        name: p.name,
        position: p.position,
        isActive: p.isActive,
        tokens: p.tokens,
        finished: p.finished,
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
      const type = id.startsWith('ludo') ? 'ludo' : 'snake';
      const boardData =
        type === 'snake'
          ? board?.snakes && board?.ladders
            ? board
            : generateBoard()
          : {};

      const record = await GameRoomModel.findOneAndUpdate(
        { roomId: id },
        {
          $setOnInsert: {
            roomId: id,
            capacity,
            gameType: type,
            status: 'waiting',
            currentTurn: 0,
            snakes: boardData.snakes,
            ladders: boardData.ladders,
            players: []
          }
        },
        { new: true, upsert: true }
      );

      room = new GameRoom(
        record.roomId,
        this.io,
        record.capacity,
        {
          snakes: Object.fromEntries(record.snakes || {}),
          ladders: Object.fromEntries(record.ladders || {})
        },
        record.gameType || 'snake'
      );
      room.players = record.players.map((p) => ({
        ...p.toObject(),
        id: p.playerId,
        socketId: null,
        lastRollTime: 0
      }));
      room.game.players = room.players;
      room.currentTurn = record.currentTurn;
      room.status = record.status;
      this.rooms.set(id, room);
    }
    return room;
  }

  async joinRoom(roomId, playerId, name, socket) {
    const parts = roomId.split('-');
    const cap = Number(parts[1]) || 4;
    const room = await this.getRoom(roomId, cap);
    let playerName = name;
    let telegramId;
    if (playerId) {
      try {
        const user = await User.findOne({ accountId: playerId }).lean();
        if (user) {
          telegramId = user.telegramId;
          if (!playerName) {
            playerName =
              user.nickname || `${user.firstName || ''} ${user.lastName || ''}`.trim();
          }
        }
      } catch {}
    }
    const result = room.addPlayer(playerId, playerName, telegramId, socket);
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
