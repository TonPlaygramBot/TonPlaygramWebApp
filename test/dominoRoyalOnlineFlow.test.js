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

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

test('Domino Royal seats lobby players and syncs table state through runtime sockets', { concurrency: false, timeout: 20000 }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');
  const env = {
    ...process.env,
    PORT: '3222',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    API_AUTH_TOKEN: apiToken,
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1'
  };
  const server = await startServer(env);
  const lobbyA = io('http://localhost:3222', { auth: { token: apiToken } });
  const lobbyB = io('http://localhost:3222', { auth: { token: apiToken } });

  try {
    await Promise.all([once(lobbyA, 'connect'), once(lobbyB, 'connect')]);
    await Promise.all([
      emitAck(lobbyA, 'register', { playerId: 'domino-a' }),
      emitAck(lobbyB, 'register', { playerId: 'domino-b' })
    ]);

    const firstSeat = await emitAck(lobbyA, 'seatTable', {
      accountId: 'domino-a',
      gameType: 'domino-royal',
      stake: 100,
      maxPlayers: 2,
      playerName: 'A',
      mode: 'online',
      token: 'TPC',
      variant: 'single'
    });
    const secondSeat = await emitAck(lobbyB, 'seatTable', {
      accountId: 'domino-b',
      gameType: 'domino-royal',
      stake: 100,
      maxPlayers: 2,
      playerName: 'B',
      mode: 'online',
      token: 'TPC',
      variant: 'single'
    });

    assert.equal(firstSeat.success, true);
    assert.equal(secondSeat.success, true);
    assert.equal(secondSeat.tableId, firstSeat.tableId);

    lobbyA.emit('confirmReady', { accountId: 'domino-a', tableId: firstSeat.tableId });
    lobbyB.emit('confirmReady', { accountId: 'domino-b', tableId: firstSeat.tableId });
    const [startA, startB] = await Promise.all([
      once(lobbyA, 'gameStart'),
      once(lobbyB, 'gameStart')
    ]);
    assert.equal(startA.tableId, firstSeat.tableId);
    assert.equal(startB.players.length, 2);

    const runtimeA = io('http://localhost:3222', { auth: { token: apiToken, accountId: 'domino-a' } });
    const runtimeB = io('http://localhost:3222', { auth: { token: apiToken, accountId: 'domino-b' } });
    await Promise.all([once(runtimeA, 'connect'), once(runtimeB, 'connect')]);
    await Promise.all([
      emitAck(runtimeA, 'register', { playerId: 'domino-a' }),
      emitAck(runtimeB, 'register', { playerId: 'domino-b' })
    ]);

    const joinA = await emitAck(runtimeA, 'joinGameTable', {
      accountId: 'domino-a',
      tableId: firstSeat.tableId,
      gameType: 'domino-royal'
    });
    const joinB = await emitAck(runtimeB, 'joinGameTable', {
      accountId: 'domino-b',
      tableId: firstSeat.tableId,
      gameType: 'domino-royal'
    });
    assert.equal(joinA.success, true);
    assert.equal(joinB.success, true);
    assert.equal(joinB.players.length, 2);

    const state = {
      players: [
        { id: 0, hand: [{ a: 6, b: 5 }] },
        { id: 1, hand: [{ a: 1, b: 1 }] }
      ],
      boneyard: [],
      chain: [{ tile: { a: 6, b: 6 }, x: 0, z: 0, rot: 1.5708, double: true }],
      ends: {
        L: { v: 6, x: 0, z: 0, dir: [-1, 0], orient: 3.14159 },
        R: { v: 6, x: 0, z: 0, dir: [1, 0], orient: 0 }
      },
      current: 0,
      gameFinished: false
    };

    const received = once(runtimeB, 'dominoRoyalState');
    const syncAck = await emitAck(runtimeA, 'dominoRoyalState', {
      accountId: 'domino-a',
      tableId: firstSeat.tableId,
      action: 'init',
      state
    });
    assert.equal(syncAck.success, true);
    const message = await received;
    assert.equal(message.tableId, firstSeat.tableId);
    assert.equal(message.state.players[0].hand[0].a, 6);
    assert.equal(message.currentTurn, 'domino-a');

    runtimeA.disconnect();
    runtimeB.disconnect();
  } finally {
    lobbyA.disconnect();
    lobbyB.disconnect();
    server.kill();
  }
});
