import { RedisDriver } from '@colyseus/redis-driver';
import { RedisPresence } from '@colyseus/redis-presence';
import { defineRoom } from 'colyseus';
import { ChessLobbyRoom } from './ChessLobbyRoom.js';

const redis = process.env.REDIS_URL;

export const chessServerConfig = {
  rooms: {
    chess_lobby: defineRoom(ChessLobbyRoom).filterBy(['visibility', 'invitationCode', 'stake', 'token'])
  },
  ...(redis ? { driver: new RedisDriver(redis), presence: new RedisPresence(redis) } : {}),
  express: (app: any) => {
    app.get('/health', (_req: any, res: any) => res.json({ ok: true, service: 'chess-colyseus', room: 'chess_lobby', maxClients: 2, redis: Boolean(redis) }));
  }
};
