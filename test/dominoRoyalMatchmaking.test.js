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

function connectSocket(port) {
  return io(`http://localhost:${port}`, { auth: { token: apiToken } });
}

function register(socket, playerId) {
  return new Promise((resolve) => {
    socket.emit('register', { playerId }, resolve);
  });
}

function seat(socket, payload) {
  return new Promise((resolve) => {
    socket.emit('seatTable', payload, resolve);
  });
}

const dominoPayload = (accountId, overrides = {}) => ({
  accountId,
  gameType: 'domino-royal',
  stake: 100,
  maxPlayers: 2,
  mode: 'online',
  token: 'TPC',
  variant: 'single',
  matchMeta: {
    mode: 'online',
    token: 'TPC',
    variant: 'single'
  },
  ...overrides
});

test(
  'Domino Royal only matches players with the same stake, player count, and game criteria',
  { concurrency: false, timeout: 30000 },
  async () => {
    fs.mkdirSync(new URL('assets', distDir), { recursive: true });
    fs.writeFileSync(new URL('index.html', distDir), '');
    const port = '3211';
    const env = {
      ...process.env,
      PORT: port,
      MONGO_URI: 'memory',
      BOT_TOKEN: 'dummy',
      API_AUTH_TOKEN: apiToken,
      SKIP_WEBAPP_BUILD: '1',
      SKIP_BOT_LAUNCH: '1',
      DOMINO_LOBBY_CONNECT_GRACE_MS: '1000'
    };
    const server = await startServer(env);
    const sockets = ['a', 'b', 'c', 'd', 'e'].map(() => connectSocket(port));

    try {
      await Promise.all(
        sockets.map(
          (socket) => new Promise((resolve) => socket.on('connect', resolve))
        )
      );
      await Promise.all(
        sockets.map((socket, index) => register(socket, `domino-${index}`))
      );

      const first = await seat(sockets[0], dominoPayload('domino-0'));
      const differentStake = await seat(
        sockets[1],
        dominoPayload('domino-1', { stake: 200 })
      );
      const differentPlayers = await seat(
        sockets[2],
        dominoPayload('domino-2', { maxPlayers: 3 })
      );
      const differentVariant = await seat(
        sockets[3],
        dominoPayload('domino-3', {
          variant: 'points',
          targetPoints: 101,
          matchMeta: {
            mode: 'online',
            token: 'TPC',
            variant: 'points',
            targetPoints: '101'
          }
        })
      );
      const matching = await seat(sockets[4], dominoPayload('domino-4'));

      assert.equal(first.success, true);
      assert.equal(differentStake.success, true);
      assert.equal(differentPlayers.success, true);
      assert.equal(differentVariant.success, true);
      assert.equal(matching.success, true);
      assert.equal(matching.tableId, first.tableId);
      assert.notEqual(differentStake.tableId, first.tableId);
      assert.notEqual(differentPlayers.tableId, first.tableId);
      assert.notEqual(differentVariant.tableId, first.tableId);

      const readyAt = Date.now();
      const gameStartPromise = new Promise((resolve) =>
        sockets[0].once('gameStart', (payload) =>
          resolve({ payload, elapsedMs: Date.now() - readyAt })
        )
      );
      sockets[0].emit('confirmReady', {
        accountId: 'domino-0',
        tableId: first.tableId
      });
      sockets[4].emit('confirmReady', {
        accountId: 'domino-4',
        tableId: first.tableId
      });

      const { payload: started, elapsedMs } = await gameStartPromise;
      assert.ok(
        elapsedMs >= 900,
        `expected connect grace before start, got ${elapsedMs}ms`
      );
      assert.equal(started.tableId, first.tableId);
      assert.equal(started.players.length, 2);
      assert.equal(started.stake, 100);
      assert.equal(started.meta.variant, 'single');
    } finally {
      sockets.forEach((socket) => socket.disconnect());
      server.kill();
    }
  }
);
