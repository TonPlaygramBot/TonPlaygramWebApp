import { randomUUID } from 'crypto';

export const RoomState = {
  LOBBY: 'lobby',
  READY: 'ready-check',
  IN_GAME: 'in-game',
  FINISHED: 'finished'
};

export class RoomService {
  constructor(games = {}) {
    this.games = games;
    this.rooms = new Map();
  }

  create(slug, opts = {}) {
    const game = this.games[slug];
    if (!game) throw new Error('unknown game');
    const room = {
      id: randomUUID(),
      slug,
      state: RoomState.LOBBY,
      maxPlayers: opts.maxPlayers || game.maxPlayers || 2,
      players: new Map(),
      ready: new Set(),
      createdAt: Date.now(),
      data: game.createState ? game.createState(opts) : {}
    };
    this.rooms.set(room.id, room);
    return room;
  }

  join(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room || room.players.size >= room.maxPlayers) return null;
    room.players.set(playerId, { id: playerId, connected: true });
    return this.snapshot(room);
  }

  leave(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.players.delete(playerId);
    room.ready.delete(playerId);
    if (room.players.size === 0) this.rooms.delete(roomId);
  }

  ready(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.ready.add(playerId);
    if (room.ready.size === room.players.size && room.players.size > 0) {
      room.state = RoomState.IN_GAME;
      room.startTime = Date.now();
    }
    return this.snapshot(room);
  }

  input(roomId, playerId, payload) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const game = this.games[room.slug];
    if (room.state === RoomState.IN_GAME && game && game.onInput) {
      game.onInput(room, playerId, payload);
    }
  }

  snapshot(room) {
    return {
      id: room.id,
      state: room.state,
      players: Array.from(room.players.keys()),
      ready: Array.from(room.ready)
    };
  }
}
