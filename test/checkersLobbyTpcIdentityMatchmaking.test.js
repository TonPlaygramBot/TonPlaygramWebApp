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
  'checkers lobby resolves Google identity to TPC account id for seat + ready',
  { concurrency: false, timeout: 20000 },
  async () => {
    fs.mkdirSync(new URL('assets', distDir), { recursive: true });
    fs.writeFileSync(new URL('index.html', distDir), '');
    const env = {
      ...process.env,
      PORT: '3211',
      MONGO_URI: 'memory',
      BOT_TOKEN: 'dummy',
      API_AUTH_TOKEN: apiToken,
      SKIP_WEBAPP_BUILD: '1',
      SKIP_BOT_LAUNCH: '1'
    };
    const server = await startServer(env);

    const createAccount = async ({ accountId, googleId, firstName }) => {
      const res = await fetch('http://localhost:3211/api/account/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`
        },
        body: JSON.stringify({ accountId, googleId, firstName })
      });
      assert.equal(res.status, 200);
    };

    await createAccount({ accountId: 'tpc-google-a', googleId: 'google-a', firstName: 'A' });
    await createAccount({ accountId: 'tpc-google-b', googleId: 'google-b', firstName: 'B' });

    const s1 = io('http://localhost:3211', { auth: { googleId: 'google-a' } });
    const s2 = io('http://localhost:3211', { auth: { googleId: 'google-b' } });

    try {
      await Promise.all([
        new Promise((resolve) => s1.on('connect', resolve)),
        new Promise((resolve) => s2.on('connect', resolve))
      ]);

      const register = (socket, accountId) =>
        new Promise((resolve) => socket.emit('register', { accountId }, resolve));
      await Promise.all([register(s1, 'google-a'), register(s2, 'google-b')]);

      const seat = (socket, accountId) =>
        new Promise((resolve) => {
          socket.emit(
            'seatTable',
            {
              accountId,
              gameType: 'checkersbattleroyal',
              stake: 50,
              maxPlayers: 2,
              mode: 'online',
              token: 'TPC'
            },
            resolve
          );
        });

      const firstSeat = await seat(s1, 'google-a');
      const secondSeat = await seat(s2, 'google-b');
      assert.equal(firstSeat.success, true);
      assert.equal(secondSeat.success, true);
      assert.equal(secondSeat.tableId, firstSeat.tableId);
      assert.ok(firstSeat.players.some((p) => p.id === 'tpc-google-a'));
      assert.ok(secondSeat.players.some((p) => p.id === 'tpc-google-b'));

      s1.emit('confirmReady', { accountId: 'google-a', tableId: firstSeat.tableId });
      s2.emit('confirmReady', { accountId: 'google-b', tableId: firstSeat.tableId });

      const [gameStartA, gameStartB] = await Promise.all([
        new Promise((resolve) => s1.once('gameStart', resolve)),
        new Promise((resolve) => s2.once('gameStart', resolve))
      ]);
      assert.equal(gameStartA.tableId, firstSeat.tableId);
      assert.equal(gameStartB.tableId, firstSeat.tableId);
      assert.ok(gameStartA.players.some((p) => p.id === 'tpc-google-a'));
      assert.ok(gameStartB.players.some((p) => p.id === 'tpc-google-b'));
    } finally {
      s1.disconnect();
      s2.disconnect();
      server.kill();
    }
  }
);
