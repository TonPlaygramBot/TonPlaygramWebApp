import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';
import { io } from 'socket.io-client';

const distDir = new URL('../webapp/dist/', import.meta.url);
const apiToken = 'test-token';

async function startServer(env) {
  const server = spawn('node', ['bot/server.js'], { env, stdio: 'pipe' });
  server.stdout.on('data', (chunk) => process.stdout.write(chunk));
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await new Promise((resolve) => {
    const onData = (chunk) => {
      if (chunk.toString().includes('Server running on port')) {
        server.stdout.off('data', onData);
        resolve();
      }
    };
    server.stdout.on('data', onData);
  });
  return server;
}

const register = (socket, playerId) =>
  new Promise((resolve) => {
    socket.emit('register', { playerId }, resolve);
  });

const seat = (socket, payload) =>
  new Promise((resolve) => {
    socket.emit('seatTable', payload, resolve);
  });

test(
  'chess quick matchmaking prunes expired lobby seats before matching same criteria players',
  { concurrency: false, timeout: 20000 },
  async () => {
    fs.mkdirSync(new URL('assets', distDir), { recursive: true });
    fs.writeFileSync(new URL('index.html', distDir), '');
    const env = {
      ...process.env,
      PORT: '3216',
      MONGO_URI: 'memory',
      BOT_TOKEN: 'dummy',
      API_AUTH_TOKEN: apiToken,
      SKIP_WEBAPP_BUILD: '1',
      SKIP_BOT_LAUNCH: '1',
      LOBBY_SEAT_TTL_MS: '100'
    };
    const server = await startServer(env);
    const stale = io('http://localhost:3216', { auth: { token: apiToken } });
    const freshA = io('http://localhost:3216', { auth: { token: apiToken } });
    const freshB = io('http://localhost:3216', { auth: { token: apiToken } });

    try {
      await Promise.all([
        new Promise((resolve) => stale.on('connect', resolve)),
        new Promise((resolve) => freshA.on('connect', resolve)),
        new Promise((resolve) => freshB.on('connect', resolve))
      ]);

      await Promise.all([
        register(stale, 'chess-expired-stale'),
        register(freshA, 'chess-expired-a'),
        register(freshB, 'chess-expired-b')
      ]);

      const sharedPayload = {
        gameType: 'chess',
        stake: 250,
        maxPlayers: 2,
        mode: 'online',
        token: 'TPC'
      };

      const staleSeat = await seat(stale, {
        ...sharedPayload,
        accountId: 'chess-expired-stale'
      });
      assert.equal(staleSeat.success, true);
      assert.equal(staleSeat.players.length, 1);

      await delay(180);

      const firstFreshSeat = await seat(freshA, {
        ...sharedPayload,
        accountId: 'chess-expired-a'
      });
      const secondFreshSeat = await seat(freshB, {
        ...sharedPayload,
        accountId: 'chess-expired-b'
      });

      assert.equal(firstFreshSeat.success, true);
      assert.equal(secondFreshSeat.success, true);
      assert.notEqual(firstFreshSeat.tableId, staleSeat.tableId);
      assert.equal(secondFreshSeat.tableId, firstFreshSeat.tableId);
      assert.deepEqual(
        secondFreshSeat.players.map((player) => player.id).sort(),
        ['chess-expired-a', 'chess-expired-b']
      );
    } finally {
      stale.disconnect();
      freshA.disconnect();
      freshB.disconnect();
      server.kill();
    }
  }
);
