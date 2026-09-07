import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as connectSocketIO } from 'socket.io-client';
import { Client, type Room } from '@colyseus/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createChessGateway } from './embedded.js';

describe('chess inside the main service', () => {
  const app = express();
  const httpServer = http.createServer(app);
  const sessions: any[] = [];
  const reservations: any[] = [];
  const releases: any[] = [];
  let gateway: Awaited<ReturnType<typeof createChessGateway>>;
  let socketIO: SocketIOServer;
  let base: string;
  let client: Client;
  const rooms: Room[] = [];
  const options = (accountId: string, extra = {}) => ({ accountId, visibility: 'public', invitationCode: '', stake: 100, token: 'TPG', ...extra });

  beforeAll(async () => {
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
    gateway = await createChessGateway({ accountApiUrl: base, gracefullyShutdown: false });
    app.use('/colyseus', gateway.handleRequest);
    app.use(express.json());
    app.get('/api/health', (_req, res) => res.json({ ok: true }));
    app.use('/api/matchmaking', (req, res, next) => {
      if (req.headers['x-matchmaking-secret'] !== process.env.MATCHMAKING_SERVICE_SECRET) {
        res.sendStatus(401);
        return;
      }
      next();
    });
    app.post('/api/matchmaking/session', (req, res) => {
      sessions.push(req.body);
      if (!req.body.accountId) { res.status(401).json({ error: 'missing_account' }); return; }
      res.json({ tpcAccountNumber: req.body.accountId, name: 'Verified player', balance: 1000 });
    });
    app.post('/api/matchmaking/reserve', (req, res) => {
      reservations.push(req.body);
      res.json({ matchId: req.body.roomId, tableNumber: 'TABLE #000001' });
    });
    app.post('/api/matchmaking/release', (req, res) => { releases.push(req.body); res.json({ ok: true }); });
    socketIO = new SocketIOServer(httpServer, { destroyUpgrade: false });
    socketIO.on('connection', (socket) => socket.on('echo', (value, reply) => reply(value)));
    httpServer.on('upgrade', (req, socket, head) => {
      if (!gateway.handleUpgrade(req, socket, head) && !req.url?.startsWith('/socket.io/')) socket.destroy();
    });
    client = new Client(`${base}/colyseus`);
  });

  afterAll(async () => {
    await Promise.all(rooms.filter((room) => room.connection.isOpen).map((room) => room.leave(true)));
    await gateway.close();
    await new Promise<void>((resolve) => socketIO.close(() => resolve()));
  });

  it('serves main API and chess health from the same public port', async () => {
    expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ ok: true });
    expect(await (await fetch(`${base}/colyseus/health`)).json()).toMatchObject({ ok: true, redis: false });
  });

  it('keeps Socket.IO connected while chess joins over the prefixed HTTP and WebSocket routes', async () => {
    const socket = connectSocketIO(base, { transports: ['websocket'], forceNew: true });
    try {
      await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
      const first = await client.joinOrCreate('chess_lobby', options('one', { initData: 'test-init-data' }));
      rooms.push(first);
      const second = await client.joinOrCreate('chess_lobby', options('two'));
      rooms.push(second);
      const third = await client.joinOrCreate('chess_lobby', options('three'));
      rooms.push(third);
      expect(second.roomId).toBe(first.roomId);
      expect(third.roomId).not.toBe(first.roomId);
      await expect.poll(() => first.state.phase).toBe('countdown');
      expect(sessions).toContainEqual(expect.objectContaining({ accountId: 'one', initData: 'test-init-data' }));
      expect(reservations).toContainEqual(expect.objectContaining({ accounts: ['one', 'two'], stake: 100, token: 'TPG' }));
      // Engine.IO's unhandled-upgrade timeout must not kill the chess socket.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      expect(first.connection.isOpen).toBe(true);
      expect(socket.connected).toBe(true);
      expect(await socket.timeout(2000).emitWithAck('echo', 'still-connected')).toBe('still-connected');
      await Promise.all([first.leave(true), second.leave(true), third.leave(true)]);
      await expect.poll(() => releases.length).toBeGreaterThan(0);
    } finally { socket.disconnect(); }
  });

  it('rejects anonymous players and wrong private codes without creating another private room', async () => {
    await expect(client.joinOrCreate('chess_lobby', options(''))).rejects.toThrow('missing_account');
    const privateOptions = { visibility: 'private', invitationCode: 'ABC123' };
    const host = await client.create('chess_lobby', options('host', privateOptions));
    rooms.push(host);
    await expect(client.join('chess_lobby', options('guest', { ...privateOptions, invitationCode: 'WRONG' }))).rejects.toThrow();
    const guest = await client.join('chess_lobby', options('guest', privateOptions));
    rooms.push(guest);
    expect(guest.roomId).toBe(host.roomId);
    await Promise.all([host.leave(true), guest.leave(true)]);
  });
});
