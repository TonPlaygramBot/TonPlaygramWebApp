import { RedisDriver } from '@colyseus/redis-driver';
import { RedisPresence } from '@colyseus/redis-presence';
import { defineRoom } from 'colyseus';
import { ChessLobbyRoom } from './ChessLobbyRoom.js';

export function createChessServerConfig({ redisUrl = process.env.REDIS_URL } = {}) {
  return {
    rooms: {
      chess_lobby: defineRoom(ChessLobbyRoom).filterBy(['visibility', 'invitationCode', 'stake', 'token'])
    },
    ...(redisUrl ? { driver: new RedisDriver(redisUrl), presence: new RedisPresence(redisUrl) } : {}),
    express: (app: any) => {
      app.get('/health', (_req: any, res: any) => res.json({ ok: true, service: 'chess-colyseus', room: 'chess_lobby', maxClients: 2, redis: Boolean(redisUrl) }));
    }
  };
}
