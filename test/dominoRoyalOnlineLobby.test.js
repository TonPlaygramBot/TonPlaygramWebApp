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

test(
  'Domino Royal lobby seats players at the same table, starts once all ready, and sends private state',
  { concurrency: false, timeout: 25000 },
  async () => {
    fs.mkdirSync(new URL('assets', distDir), { recursive: true });
    fs.writeFileSync(new URL('index.html', distDir), '');
    const env = {
      ...process.env,
      PORT: '3224',
      MONGO_URI: 'memory',
      BOT_TOKEN: 'dummy',
      API_AUTH_TOKEN: apiToken,
      SKIP_WEBAPP_BUILD: '1',
      SKIP_BOT_LAUNCH: '1'
    };
    const server = await startServer(env);
    const sockets = [
      io('http://localhost:3224', { auth: { token: apiToken } }),
      io('http://localhost:3224', { auth: { token: apiToken } }),
      io('http://localhost:3224', { auth: { token: apiToken } })
    ];

    try {
      await Promise.all(sockets.map((socket) => once(socket, 'connect')));
      await Promise.all(
        sockets.map((socket, index) =>
          emitAck(socket, 'register', {
            playerId: `domino-online-${index + 1}`,
            accountId: `domino-online-${index + 1}`,
            tpcAccountNumber: `domino-online-${index + 1}`
          })
        )
      );

      const baseSeat = {
        gameType: 'domino-royal',
        stake: 250,
        maxPlayers: 3,
        mode: 'online',
        token: 'TPC',
        variant: 'points-51',
        matchMeta: { mode: 'online', token: 'TPC', variant: 'points-51' }
      };

      const firstSeat = await emitAck(sockets[0], 'seatTable', {
        ...baseSeat,
        accountId: 'domino-online-1',
        tpcAccountNumber: 'domino-online-1',
        playerName: 'Domino A'
      });
      sockets[0].emit('confirmReady', {
        tableId: firstSeat.tableId,
        accountId: 'domino-online-1',
        tpcAccountNumber: 'domino-online-1'
      });

      const secondSeat = await emitAck(sockets[1], 'seatTable', {
        ...baseSeat,
        accountId: 'domino-online-2',
        tpcAccountNumber: 'domino-online-2',
        playerName: 'Domino B'
      });
      const thirdSeat = await emitAck(sockets[2], 'seatTable', {
        ...baseSeat,
        accountId: 'domino-online-3',
        tpcAccountNumber: 'domino-online-3',
        playerName: 'Domino C'
      });

      assert.equal(firstSeat.success, true);
      assert.equal(secondSeat.success, true);
      assert.equal(thirdSeat.success, true);
      assert.equal(secondSeat.tableId, firstSeat.tableId);
      assert.equal(thirdSeat.tableId, firstSeat.tableId);
      assert.equal(thirdSeat.players.length, 3);

      const gameStarts = sockets.map((socket) => once(socket, 'gameStart'));
      const dominoStates = sockets.map((socket) => once(socket, 'dominoState'));

      sockets[1].emit('confirmReady', {
        tableId: firstSeat.tableId,
        accountId: 'domino-online-2',
        tpcAccountNumber: 'domino-online-2'
      });
      sockets[2].emit('confirmReady', {
        tableId: firstSeat.tableId,
        accountId: 'domino-online-3',
        tpcAccountNumber: 'domino-online-3'
      });

      const starts = await Promise.all(gameStarts);
      starts.forEach((start) => {
        assert.equal(start.tableId, firstSeat.tableId);
        assert.equal(start.players.length, 3);
        assert.equal(start.meta.variant, 'points-51');
      });

      const states = await Promise.all(dominoStates);
      states.forEach((state, index) => {
        assert.equal(state.tableId, firstSeat.tableId);
        assert.equal(state.players.length, 3);
        assert.equal(state.players[index].hand.length, state.players[index].handCount);
        state.players.forEach((player, seatIndex) => {
          if (seatIndex !== index) assert.equal(player.hand.length, 0);
        });
        assert.equal(state.boneyardCount, 7);
        assert.equal(state.chain.length, 1);
      });
    } finally {
      sockets.forEach((socket) => socket.disconnect());
      server.kill();
    }
  }
);
