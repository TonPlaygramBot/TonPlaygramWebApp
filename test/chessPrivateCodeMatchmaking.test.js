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

test(
  'chess private code reserves the requested table id so both phones join the same lobby',
  { concurrency: false, timeout: 20000 },
  async () => {
    fs.mkdirSync(new URL('assets', distDir), { recursive: true });
    fs.writeFileSync(new URL('index.html', distDir), '');
    const port = '3214';
    const env = {
      ...process.env,
      PORT: port,
      MONGO_URI: 'memory',
      BOT_TOKEN: 'dummy',
      API_AUTH_TOKEN: apiToken,
      SKIP_WEBAPP_BUILD: '1',
      SKIP_BOT_LAUNCH: '1'
    };
    const server = await startServer(env);
    const s1 = connectSocket(port);
    const s2 = connectSocket(port);

    try {
      await Promise.all([
        new Promise((resolve) => s1.on('connect', resolve)),
        new Promise((resolve) => s2.on('connect', resolve))
      ]);
      await Promise.all([register(s1, 'chess-private-a'), register(s2, 'chess-private-b')]);

      const privateTableId = 'chess-2-host-FRIEND123';
      const firstSeat = await seat(s1, {
        accountId: 'chess-private-a',
        gameType: 'chess',
        stake: 100,
        maxPlayers: 2,
        mode: 'online',
        token: 'TPC',
        tableId: privateTableId
      });
      const secondSeat = await seat(s2, {
        accountId: 'chess-private-b',
        gameType: 'chess',
        stake: 100,
        maxPlayers: 2,
        mode: 'online',
        token: 'TPC',
        tableId: privateTableId
      });

      assert.equal(firstSeat.success, true);
      assert.equal(firstSeat.tableId, privateTableId);
      assert.equal(secondSeat.success, true);
      assert.equal(secondSeat.tableId, privateTableId);
      assert.equal(secondSeat.players.length, 2);
    } finally {
      s1.disconnect();
      s2.disconnect();
      server.kill();
    }
  }
);

test(
  'chess private code rejects a different stake instead of silently entering another table',
  { concurrency: false, timeout: 20000 },
  async () => {
    fs.mkdirSync(new URL('assets', distDir), { recursive: true });
    fs.writeFileSync(new URL('index.html', distDir), '');
    const port = '3215';
    const env = {
      ...process.env,
      PORT: port,
      MONGO_URI: 'memory',
      BOT_TOKEN: 'dummy',
      API_AUTH_TOKEN: apiToken,
      SKIP_WEBAPP_BUILD: '1',
      SKIP_BOT_LAUNCH: '1'
    };
    const server = await startServer(env);
    const s1 = connectSocket(port);
    const s2 = connectSocket(port);

    try {
      await Promise.all([
        new Promise((resolve) => s1.on('connect', resolve)),
        new Promise((resolve) => s2.on('connect', resolve))
      ]);
      await Promise.all([register(s1, 'chess-stake-private-a'), register(s2, 'chess-stake-private-b')]);

      const privateTableId = 'chess-2-host-STAKELOCK';
      const firstSeat = await seat(s1, {
        accountId: 'chess-stake-private-a',
        gameType: 'chess',
        stake: 100,
        maxPlayers: 2,
        mode: 'online',
        token: 'TPC',
        tableId: privateTableId
      });
      const mismatchedSeat = await seat(s2, {
        accountId: 'chess-stake-private-b',
        gameType: 'chess',
        stake: 500,
        maxPlayers: 2,
        mode: 'online',
        token: 'TPC',
        tableId: privateTableId
      });

      assert.equal(firstSeat.success, true);
      assert.equal(firstSeat.tableId, privateTableId);
      assert.equal(mismatchedSeat.success, false);
      assert.equal(mismatchedSeat.error, 'stake_mismatch');
    } finally {
      s1.disconnect();
      s2.disconnect();
      server.kill();
    }
  }
);
