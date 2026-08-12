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

test(
  'chess quick matchmaking removes expired players instead of starting against a ghost seat',
  { concurrency: false, timeout: 20000 },
  async () => {
    fs.mkdirSync(new URL('assets', distDir), { recursive: true });
    fs.writeFileSync(new URL('index.html', distDir), '');
    const server = await startServer({
      ...process.env,
      PORT: '3222',
      MONGO_URI: 'memory',
      BOT_TOKEN: 'dummy',
      API_AUTH_TOKEN: apiToken,
      LOBBY_SEAT_TTL_MS: '50',
      SKIP_WEBAPP_BUILD: '1',
      SKIP_BOT_LAUNCH: '1'
    });
    const stale = io('http://localhost:3222', { auth: { token: apiToken } });
    const waiting = io('http://localhost:3222', { auth: { token: apiToken } });

    try {
      await Promise.all([
        new Promise((resolve) => stale.on('connect', resolve)),
        new Promise((resolve) => waiting.on('connect', resolve))
      ]);
      await Promise.all([
        new Promise((resolve) => stale.emit('register', { playerId: 'expired-chess-player' }, resolve)),
        new Promise((resolve) => waiting.emit('register', { playerId: 'waiting-chess-player' }, resolve))
      ]);

      const seat = (socket, accountId) =>
        new Promise((resolve) => socket.emit('seatTable', {
          accountId,
          gameType: 'chess',
          stake: 100,
          maxPlayers: 2,
          mode: 'online',
          token: 'TPG'
        }, resolve));

      const staleSeat = await seat(stale, 'expired-chess-player');
      assert.equal(staleSeat.success, true);
      await delay(80);

      const waitingSeat = await seat(waiting, 'waiting-chess-player');
      assert.equal(waitingSeat.success, true);
      assert.notEqual(waitingSeat.tableId, staleSeat.tableId);
      assert.deepEqual(
        waitingSeat.players.map((player) => player.tpcAccountNumber),
        ['waiting-chess-player']
      );
    } finally {
      stale.disconnect();
      waiting.disconnect();
      server.kill();
    }
  }
);
