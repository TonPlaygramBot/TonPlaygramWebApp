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
  'chess battle royal aliases with the same criteria seat players at one table',
  { concurrency: false, timeout: 20000 },
  async () => {
    fs.mkdirSync(new URL('assets', distDir), { recursive: true });
    fs.writeFileSync(new URL('index.html', distDir), '');
    const env = {
      ...process.env,
      PORT: '3221',
      MONGO_URI: 'memory',
      BOT_TOKEN: 'dummy',
      API_AUTH_TOKEN: apiToken,
      SKIP_WEBAPP_BUILD: '1',
      SKIP_BOT_LAUNCH: '1'
    };
    const server = await startServer(env);
    const s1 = io('http://localhost:3221', { auth: { token: apiToken } });
    const s2 = io('http://localhost:3221', { auth: { token: apiToken } });

    try {
      await Promise.all([
        new Promise((resolve) => s1.on('connect', resolve)),
        new Promise((resolve) => s2.on('connect', resolve))
      ]);

      const register = (socket, playerId) =>
        new Promise((resolve) => socket.emit('register', { playerId }, resolve));
      await Promise.all([
        register(s1, 'chess-alias-a'),
        register(s2, 'chess-alias-b')
      ]);

      const seat = (socket, payload) =>
        new Promise((resolve) => socket.emit('seatTable', payload, resolve));

      const firstSeat = await seat(s1, {
        accountId: 'chess-alias-a',
        gameType: 'Chess Battle Royal',
        stake: '100.00',
        maxPlayers: 2,
        mode: 'Online',
        token: 'TPC',
        preferredSide: 'WHITE'
      });
      const secondSeat = await seat(s2, {
        accountId: 'chess-alias-b',
        gameType: 'chess-battle-royale',
        stake: 100,
        maxPlayers: 2,
        mode: 'online',
        token: 'tpc',
        preferredSide: 'black'
      });

      assert.equal(firstSeat.success, true);
      assert.equal(secondSeat.success, true);
      assert.equal(secondSeat.tableId, firstSeat.tableId);
      assert.equal(secondSeat.players.length, 2);
    } finally {
      s1.disconnect();
      s2.disconnect();
      server.kill();
    }
  }
);
