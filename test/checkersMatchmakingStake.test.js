import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';
import { io } from 'socket.io-client';

const distDir = new URL('../webapp/dist/', import.meta.url);
const apiToken = 'test-token';

async function startServer(env) {
  const server = spawn('node', ['bot/server.js'], { env, stdio: 'pipe' });
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

function connectClient(port) {
  return io(`http://localhost:${port}`, { auth: { token: apiToken } });
}

test(
  'checkers players with the same stake share a table even with different matchmaking metadata',
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
    const s1 = connectClient(3221);
    const s2 = connectClient(3221);

    try {
      await Promise.all([
        new Promise((resolve) => s1.on('connect', resolve)),
        new Promise((resolve) => s2.on('connect', resolve))
      ]);

      s1.emit('register', { playerId: 'acct-checkers-1' });
      s2.emit('register', { playerId: 'acct-checkers-2' });

      const firstSeat = await new Promise((resolve) => {
        s1.emit(
          'seatTable',
          {
            accountId: 'acct-checkers-1',
            gameType: 'checkers',
            stake: 100,
            maxPlayers: 2,
            mode: 'online',
            token: 'TPC',
            preferredSide: 'white',
            playerName: 'CheckersOne'
          },
          resolve
        );
      });

      const secondSeat = await new Promise((resolve) => {
        s2.emit(
          'seatTable',
          {
            accountId: 'acct-checkers-2',
            gameType: 'checkers',
            stake: 100,
            maxPlayers: 2,
            mode: 'online',
            token: 'TON',
            preferredSide: 'black',
            playerName: 'CheckersTwo'
          },
          resolve
        );
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
