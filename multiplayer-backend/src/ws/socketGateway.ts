import { Server } from 'socket.io';
import { createServer } from 'node:http';
import type { Express } from 'express';
import type { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../logger/index.js';
import { MatchmakingService } from '../services/matchmakingService.js';
import { RoomService } from '../services/roomService.js';
import { GameValidator } from '../services/gameValidator.js';
import { MatchStateService } from '../services/matchStateService.js';
import { SessionRegistry } from '../services/sessionRegistry.js';
import { extractSocketUser } from './socketAuth.js';
import { matchActionSchema, matchResultSchema, queueJoinSchema, roomCreateSchema, roomJoinSchema } from '../utils/validation.js';
import { createMatch, finishMatch, startMatch } from '../repositories/matchRepository.js';
import { logConnectionEvent } from '../repositories/auditRepository.js';
import { upsertUser } from '../repositories/userRepository.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socket.js';

const matchmaking = new MatchmakingService();
const roomService = new RoomService();
const validator = new GameValidator();
const stateService = new MatchStateService();
const sessions = new SessionRegistry();

export function createRealtimeServer(app: Express) {
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
      credentials: true,
    },
    pingTimeout: env.SOCKET_PING_TIMEOUT,
    pingInterval: env.SOCKET_PING_INTERVAL,
  });

  io.use((socket, next) => {
    const user = extractSocketUser(socket);
    if (!user) {
      return next(new Error('Unauthorized'));
    }
    socket.data.user = user;
    return next();
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user as { id: string; username: string };
    sessions.setSocket(user.id, socket.id);
    await upsertUser(user.id, user.username);
    await logConnectionEvent({ userId: user.id, socketId: socket.id, event: 'connected' });

    socket.emit('player:connect', { userId: user.id, socketId: socket.id });
    const room = roomService.getRoomByUser(user.id);
    if (room) {
      socket.emit('player:reconnect', { userId: user.id, matchId: room.matchId });
    }

    socket.on('player:queue_join', async (payload) => {
      const parsed = queueJoinSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', { code: 'QUEUE_INVALID_PAYLOAD', message: 'Invalid queue payload', details: parsed.error.flatten() });
        return;
      }

      const queueEntry = {
        userId: user.id,
        username: user.username,
        gameMode: parsed.data.gameMode,
        region: parsed.data.region,
        joinedAt: Date.now(),
      };

      await matchmaking.joinQueue(queueEntry);

      const pair = await matchmaking.popMatchPair(user.id);
      if (!pair) {
        return;
      }

      const [playerA, playerB] = pair;
      const playerASocketId = sessions.getSocket(playerA.userId);
      const playerBSocketId = sessions.getSocket(playerB.userId);

      if (!playerASocketId || !playerBSocketId) {
        if (playerASocketId) {
          await matchmaking.joinQueue(playerA);
          io.to(playerASocketId).emit('error', {
            code: 'QUEUE_RETRYING',
            message: 'Opponent disconnected while matching. Searching again.',
          });
        }
        if (playerBSocketId) {
          await matchmaking.joinQueue(playerB);
          io.to(playerBSocketId).emit('error', {
            code: 'QUEUE_RETRYING',
            message: 'Opponent disconnected while matching. Searching again.',
          });
        }
        return;
      }

      const dbMatch = await createMatch({
        roomCode: `MM-${Date.now().toString().slice(-6)}`,
        isPrivate: false,
        createdByUser: playerA.userId,
        players: [
          { userId: playerA.userId, role: 'player1' },
          { userId: playerB.userId, role: 'player2' },
        ],
      });

      const generatedRoom = roomService.createRoom(playerA.userId, false, dbMatch.id);
      roomService.joinRoom(playerB.userId, generatedRoom.roomCode);
      const initialState = stateService.createInitialState(dbMatch.id, playerA.userId, playerB.userId);
      await startMatch(dbMatch.id, initialState as unknown as Prisma.JsonObject);

      [
        { playerId: playerA.userId, socketId: playerASocketId },
        { playerId: playerB.userId, socketId: playerBSocketId },
      ].forEach(({ playerId, socketId }) => {
        io.to(socketId).emit('match:found', {
          matchId: dbMatch.id,
          roomCode: generatedRoom.roomCode,
          opponentUserId: playerId === playerA.userId ? playerB.userId : playerA.userId,
        });
        io.to(socketId).emit('match:start', { matchId: dbMatch.id, initialState });
      });
    });

    socket.on('player:queue_leave', async () => {
      await matchmaking.leaveQueue(user.id);
    });

    socket.on('room:create', async (payload) => {
      const parsed = roomCreateSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', { code: 'ROOM_CREATE_INVALID', message: 'Invalid room:create payload' });
        return;
      }

      const dbMatch = await createMatch({
        roomCode: `PR-${Date.now().toString().slice(-6)}`,
        isPrivate: parsed.data.isPrivate,
        createdByUser: user.id,
        players: [{ userId: user.id, role: 'host' }],
      });

      const created = roomService.createRoom(user.id, parsed.data.isPrivate, dbMatch.id);
      socket.join(created.roomCode);
      socket.emit('match:found', { matchId: dbMatch.id, roomCode: created.roomCode, opponentUserId: '' });
    });

    socket.on('room:join', (payload) => {
      const parsed = roomJoinSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', { code: 'ROOM_JOIN_INVALID', message: 'Invalid room:join payload' });
        return;
      }

      const joined = roomService.joinRoom(user.id, parsed.data.roomCode);
      if (!joined) {
        socket.emit('error', { code: 'ROOM_JOIN_FAILED', message: 'Room unavailable' });
        return;
      }

      socket.join(joined.roomCode);
      const [first, second] = Array.from(joined.members);
      const state = stateService.createInitialState(joined.matchId, first, second);
      io.to(joined.roomCode).emit('match:start', { matchId: joined.matchId, initialState: state });
    });

    socket.on('room:leave', () => {
      const leftRoom = roomService.leaveRoom(user.id);
      if (leftRoom) {
        socket.leave(leftRoom.roomCode);
      }
    });

    socket.on('match:action', (payload) => {
      const parsed = matchActionSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', { code: 'ACTION_INVALID', message: 'Invalid action payload' });
        return;
      }

      const state = stateService.getState(parsed.data.matchId);
      const result = validator.validateAction(parsed.data, state, user.id);
      if (!result.valid) {
        socket.emit('match:validated_action', { matchId: parsed.data.matchId, tick: parsed.data.tick, accepted: false });
        return;
      }

      try {
        const updatedState = stateService.applyValidatedAction(parsed.data, user.id);
        const room = roomService.getRoomByUser(user.id);
        if (room) {
          io.to(room.roomCode).emit('match:state_update', updatedState);
        }
        socket.emit('match:validated_action', { matchId: parsed.data.matchId, tick: parsed.data.tick, accepted: true });
      } catch (error) {
        socket.emit('error', { code: 'ACTION_REJECTED', message: (error as Error).message });
      }
    });

    socket.on('match:end', async (payload) => {
      const parsed = matchResultSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', { code: 'MATCH_END_INVALID', message: 'Invalid match result payload' });
        return;
      }

      const room = roomService.getRoomByUser(user.id);
      if (!room || room.matchId !== parsed.data.matchId) {
        socket.emit('error', { code: 'MATCH_END_SPOOFED', message: 'You are not in this match' });
        return;
      }

      const endedState = stateService.endMatch(parsed.data.matchId);
      await finishMatch({
        matchId: parsed.data.matchId,
        winnerUserId: parsed.data.winnerUserId,
        scoreByUser: parsed.data.scoreByUser,
        resultSummary: {
          reason: parsed.data.reason,
          scores: parsed.data.scoreByUser,
          endedState,
        } as Prisma.JsonObject,
      });

      io.to(room.roomCode).emit('match:end', parsed.data);
    });

    socket.on('ping', () => {
      socket.emit('match:validated_action', { matchId: 'heartbeat', tick: Date.now(), accepted: true });
    });

    socket.on('disconnect', async () => {
      sessions.removeSocket(user.id);
      await matchmaking.leaveQueue(user.id);
      await logConnectionEvent({ userId: user.id, socketId: socket.id, event: 'disconnected' });

      const activeRoom = roomService.getRoomByUser(user.id);
      if (activeRoom) {
        socket.to(activeRoom.roomCode).emit('player:disconnect', { userId: user.id });
      }
      logger.info({ userId: user.id, socketId: socket.id }, 'Socket disconnected');
    });
  });

  return { io, httpServer };
}
