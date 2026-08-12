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
        token: 'TPG',
        preferredSide: 'WHITE'
      });
      const secondSeat = await seat(s2, {
        accountId: 'chess-alias-b',
        gameType: 'chess-battle-royale',
        stake: 100,
        maxPlayers: 2,
        // Quick matchmaking intentionally ignores every criterion except the
        // numeric stake, including legacy client mode/token metadata.
        mode: 'ranked',
        token: 'legacy-tpc',
        preferredSide: 'black'
      });

      assert.equal(firstSeat.success, true);
      assert.equal(secondSeat.success, true);
      assert.equal(secondSeat.tableId, firstSeat.tableId);
      assert.match(firstSeat.tableNumber, /^CBR-\w{6,}$/);
      assert.equal(secondSeat.tableNumber, firstSeat.tableNumber);
      assert.equal(secondSeat.players.length, 2);
      assert.deepEqual(
        secondSeat.players.map((player) => player.tpcAccountNumber),
        ['chess-alias-a', 'chess-alias-b']
      );
      // A mobile reconnect can restore its seat after both seats have filled
      // but before the one-second start lock completes. It must rejoin the
      // same full table rather than being moved into a fresh empty queue.
      await new Promise((resolve) => setTimeout(resolve, 550));
      const restoredSeat = await seat(s2, {
        accountId: 'chess-alias-b',
        gameType: 'chess',
        stake: 100,
        maxPlayers: 2,
        mode: 'online',
        token: 'TPG',
        tableId: secondSeat.tableId
      });
      assert.equal(restoredSeat.success, true);
      assert.equal(restoredSeat.tableId, firstSeat.tableId);
      assert.equal(restoredSeat.players.length, 2);
      // Chess has no ready-up screen: seating the second same-stake player is
      // sufficient to start both clients without a confirmReady round trip.
      const [gameStartA, gameStartB] = await Promise.all([
        new Promise((resolve) => s1.once('gameStart', resolve)),
        new Promise((resolve) => s2.once('gameStart', resolve))
      ]);
      assert.equal(gameStartA.tableId, firstSeat.tableId);
      assert.equal(gameStartB.tableNumber, firstSeat.tableNumber);
    } finally {
      s1.disconnect();
      s2.disconnect();
      server.kill();
    }
  }
);
