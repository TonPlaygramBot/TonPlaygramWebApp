import 'dotenv/config';
import { RedisDriver } from '@colyseus/redis-driver';
import { RedisPresence } from '@colyseus/redis-presence';
import { defineServer, defineRoom } from 'colyseus';
import { ChessLobbyRoom } from './ChessLobbyRoom.js';

const redis = process.env.REDIS_URL;
const server = defineServer({
  rooms: {
    chess_lobby: defineRoom(ChessLobbyRoom).filterBy(['visibility', 'invitationCode', 'maxPlayers'])
  },
  ...(redis ? { driver: new RedisDriver(redis), presence: new RedisPresence(redis) } : {}),
  express: (app) => {
    app.get('/health', (_req, res) => res.json({ ok: true, service: 'chess-colyseus', redis: Boolean(redis) }));
  }
});

server.listen(Number(process.env.PORT) || 2567);
