import TexasHoldemRoomModel from './models/TexasHoldemRoom.js';
import { TexasHoldemGame } from './logic/texasHoldemGame.js';

export class TexasHoldemRoom {
  constructor(id, io, capacity = 6, options = {}) {
    this.id = id;
    this.io = io;
    this.capacity = capacity;
    this.options = options;
    this.players = [];
    this.status = 'waiting';
    this.game = null;
    this.turnTimer = null;
  }

  addPlayer(playerId, name, socket) {
    const existing = this.players.find((p) => p.playerId === playerId);
    if (existing) {
      existing.socketId = socket.id;
      existing.disconnected = false;
      socket.join(this.id);
      socket.emit('joined', { roomId: this.id });
      return { success: true };
    }
    if (this.players.length >= this.capacity || this.status !== 'waiting') {
      return { error: 'Room full or game in progress' };
    }
    this.players.push({
      playerId,
      name,
      socketId: socket.id,
      chips: this.options.startingChips || 100,
      bet: 0,
      totalBet: 0,
      folded: false,
      disconnected: false
    });
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
    this.game = new TexasHoldemGame(this.players.map((p) => p.playerId), this.options);
    // deal hands privately
    this.players.forEach((p) => {
      const sock = this.io.sockets.sockets.get(p.socketId);
      if (sock) sock.emit('holeCards', this.game.players[p.index].hand);
    });
    this.emitState();
  }

  emitState() {
    const state = this.game.stateFor();
    this.io.to(this.id).emit('state', state);
  }

  handleAction(socket, action) {
    if (this.status !== 'playing') return;
    const player = this.players.find((p) => p.socketId === socket.id);
    if (!player) return;
    const result = this.game.playerAction(player.playerId, action);
    this.emitState();
    if (result && result.showdown) {
      this.io.to(this.id).emit('showdown', result.showdown);
      this.status = 'waiting';
      clearTimeout(this.turnTimer);
    }
    return result;
  }

  handleDisconnect(socket) {
    const player = this.players.find((p) => p.socketId === socket.id);
    if (player) {
      player.disconnected = true;
      if (this.status === 'playing') {
        this.game.playerAction(player.playerId, 'fold');
        this.emitState();
      }
    }
  }

  toDoc() {
    return {
      roomId: this.id,
      capacity: this.capacity,
      status: this.status,
      dealer: this.game ? this.game.dealer : 0,
      currentPlayer: this.game ? this.game.turn : 0,
      blinds: this.game ? this.game.blinds : { small: 5, big: 10 },
      pot: this.game ? this.game.pot : 0,
      deck: this.game ? this.game.deck : [],
      community: this.game ? this.game.community : [],
      players: this.players.map((p, idx) => ({
        playerId: p.playerId,
        name: p.name,
        chips: this.game ? this.game.players[idx].chips : p.chips,
        bet: this.game ? this.game.players[idx].bet : p.bet,
        totalBet: this.game ? this.game.players[idx].totalBet : p.totalBet,
        folded: this.game ? this.game.players[idx].folded : p.folded,
        disconnected: p.disconnected
      }))
    };
  }
}

export class TexasHoldemRoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  async loadRooms() {
    const docs = await TexasHoldemRoomModel.find({});
    for (const doc of docs) {
      const room = new TexasHoldemRoom(doc.roomId, this.io, doc.capacity, {
        startingChips: doc.players[0]?.chips || 100,
        blinds: doc.blinds
      });
      room.status = doc.status;
      room.players = doc.players.map((p, idx) => ({
        playerId: p.playerId,
        name: p.name,
        socketId: null,
        chips: p.chips,
        bet: p.bet,
        totalBet: p.totalBet,
        folded: p.folded,
        disconnected: true
      }));
      if (doc.status === 'playing') {
        room.game = new TexasHoldemGame(room.players.map((p) => p.playerId), {
          startingChips: doc.players[0]?.chips || 100,
          blinds: doc.blinds
        });
        room.game.deck = doc.deck;
        room.game.community = doc.community;
        room.game.pot = doc.pot;
        room.game.dealer = doc.dealer;
        room.game.turn = doc.currentPlayer;
        room.game.players.forEach((gp, i) => {
          gp.chips = doc.players[i].chips;
          gp.bet = doc.players[i].bet;
          gp.totalBet = doc.players[i].totalBet;
          gp.folded = doc.players[i].folded;
        });
      }
      this.rooms.set(room.id, room);
    }
  }

  async saveRoom(room) {
    await TexasHoldemRoomModel.findOneAndUpdate({ roomId: room.id }, room.toDoc(), {
      upsert: true
    });
  }

  async getRoom(id, capacity = 6, options = {}) {
    let room = this.rooms.get(id);
    if (!room) {
      const record = await TexasHoldemRoomModel.findOne({ roomId: id });
      if (record) {
        room = new TexasHoldemRoom(record.roomId, this.io, record.capacity, {
          startingChips: record.players[0]?.chips || 100,
          blinds: record.blinds
        });
        room.status = record.status;
        room.players = record.players.map((p) => ({
          playerId: p.playerId,
          name: p.name,
          socketId: null,
          chips: p.chips,
          bet: p.bet,
          totalBet: p.totalBet,
          folded: p.folded,
          disconnected: true
        }));
      } else {
        room = new TexasHoldemRoom(id, this.io, capacity, options);
        await this.saveRoom(room);
      }
      this.rooms.set(id, room);
    }
    return room;
  }

  async joinRoom(roomId, playerId, name, socket) {
    const room = await this.getRoom(roomId);
    const result = room.addPlayer(playerId, name, socket);
    await this.saveRoom(room);
    return result;
  }

  async handleAction(socket, action) {
    const room = this.findRoomBySocket(socket.id);
    if (room) {
      const res = room.handleAction(socket, action);
      await this.saveRoom(room);
      if (room.players.every((p) => p.disconnected)) {
        this.rooms.delete(room.id);
        await TexasHoldemRoomModel.deleteOne({ roomId: room.id });
      }
      return res;
    }
  }

  async handleDisconnect(socket) {
    const room = this.findRoomBySocket(socket.id);
    if (room) {
      room.handleDisconnect(socket);
      await this.saveRoom(room);
      if (room.players.every((p) => p.disconnected)) {
        this.rooms.delete(room.id);
        await TexasHoldemRoomModel.deleteOne({ roomId: room.id });
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

export default { TexasHoldemRoom, TexasHoldemRoomManager };
