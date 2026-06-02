import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';
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

test(
  'chess private code matchmaking keeps coded tables isolated from quick lobbies',
  { concurrency: false, timeout: 20000 },
  async () => {
    fs.mkdirSync(new URL('assets', distDir), { recursive: true });
    fs.writeFileSync(new URL('index.html', distDir), '');
    const env = {
      ...process.env,
      PORT: '3214',
      MONGO_URI: 'memory',
      BOT_TOKEN: 'dummy',
      API_AUTH_TOKEN: apiToken,
      SKIP_WEBAPP_BUILD: '1',
      SKIP_BOT_LAUNCH: '1'
    };
    const server = await startServer(env);
    const quick = io('http://localhost:3214', { auth: { token: apiToken } });
    const privateA = io('http://localhost:3214', { auth: { token: apiToken } });
    const privateB = io('http://localhost:3214', { auth: { token: apiToken } });

    try {
      await Promise.all([
        new Promise((resolve) => quick.on('connect', resolve)),
        new Promise((resolve) => privateA.on('connect', resolve)),
        new Promise((resolve) => privateB.on('connect', resolve))
      ]);

      const register = (socket, playerId) =>
        new Promise((resolve) => {
          socket.emit('register', { playerId }, resolve);
        });
      await Promise.all([
        register(quick, 'chess-private-quick'),
        register(privateA, 'chess-private-a'),
        register(privateB, 'chess-private-b')
      ]);

      const seat = (socket, payload) =>
        new Promise((resolve) => {
          socket.emit('seatTable', payload, resolve);
        });

      const quickSeat = await seat(quick, {
        accountId: 'chess-private-quick',
        gameType: 'chess',
        stake: 100,
        maxPlayers: 2,
        mode: 'online',
        token: 'TPC'
      });
      const codedSeatA = await seat(privateA, {
        accountId: 'chess-private-a',
        gameType: 'chess',
        stake: 100,
        maxPlayers: 2,
        mode: 'online',
        token: 'TPC',
        tableId: 'chess-2-host-FRIEND123'
      });
      const codedSeatB = await seat(privateB, {
        accountId: 'chess-private-b',
        gameType: 'chessbattleroyal',
        stake: 100,
        maxPlayers: 2,
        mode: 'online',
        token: 'TPC',
        tableId: 'chess-2-host-FRIEND123'
      });

      assert.equal(quickSeat.success, true);
      assert.equal(codedSeatA.success, true);
      assert.equal(codedSeatB.success, true);
      assert.notEqual(codedSeatA.tableId, quickSeat.tableId);
      assert.equal(codedSeatA.tableId, 'chess-2-host-FRIEND123');
      assert.equal(codedSeatB.tableId, codedSeatA.tableId);
    } finally {
      quick.disconnect();
      privateA.disconnect();
      privateB.disconnect();
      server.kill();
    }
  }
);
