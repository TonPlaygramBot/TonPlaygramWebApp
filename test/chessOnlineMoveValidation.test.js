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

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

test(
  'chess online moves are server-authoritative and synchronized',
  { concurrency: false, timeout: 20000 },
  async () => {
    fs.mkdirSync(new URL('assets', distDir), { recursive: true });
    fs.writeFileSync(new URL('index.html', distDir), '');
    const env = {
      ...process.env,
      PORT: '3213',
      MONGO_URI: 'memory',
      BOT_TOKEN: 'dummy',
      API_AUTH_TOKEN: apiToken,
      SKIP_WEBAPP_BUILD: '1',
      SKIP_BOT_LAUNCH: '1'
    };
    const server = await startServer(env);
    const white = io('http://localhost:3213', { auth: { token: apiToken } });
    const black = io('http://localhost:3213', { auth: { token: apiToken } });

    try {
      await Promise.all([once(white, 'connect'), once(black, 'connect')]);
      await Promise.all([
        emitAck(white, 'register', { playerId: 'white-player' }),
        emitAck(black, 'register', { playerId: 'black-player' })
      ]);

      const firstSeat = await emitAck(white, 'seatTable', {
        accountId: 'white-player',
        gameType: 'chess',
        stake: 100,
        maxPlayers: 2,
        mode: 'online',
        token: 'TPC',
        preferredSide: 'white'
      });
      const secondSeat = await emitAck(black, 'seatTable', {
        accountId: 'black-player',
        gameType: 'chess',
        stake: 100,
        maxPlayers: 2,
        mode: 'online',
        token: 'TPC',
        preferredSide: 'black'
      });
      assert.equal(firstSeat.success, true);
      assert.equal(secondSeat.success, true);
      assert.equal(secondSeat.tableId, firstSeat.tableId);

      white.emit('confirmReady', { accountId: 'white-player', tableId: firstSeat.tableId });
      black.emit('confirmReady', { accountId: 'black-player', tableId: firstSeat.tableId });
      await Promise.all([once(white, 'gameStart'), once(black, 'gameStart')]);

      white.emit('joinChessRoom', { tableId: firstSeat.tableId, accountId: 'white-player' });
      black.emit('joinChessRoom', { tableId: firstSeat.tableId, accountId: 'black-player' });
      await Promise.all([once(white, 'chessState'), once(black, 'chessState')]);

      const illegalAck = await emitAck(black, 'chessMove', {
        tableId: firstSeat.tableId,
        move: { lastMove: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } } }
      });
      assert.equal(illegalAck.success, false);
      assert.equal(illegalAck.error, 'wrong_player_turn');

      const blackUpdate = once(black, 'chessMove');
      const legalAck = await emitAck(white, 'chessMove', {
        tableId: firstSeat.tableId,
        move: { lastMove: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } } }
      });
      assert.equal(legalAck.success, true);
      assert.equal(legalAck.state.turnWhite, false);
      assert.equal(legalAck.state.board[4][4].t, 'P');
      assert.equal(legalAck.state.board[4][4].w, true);
      assert.equal(legalAck.state.board[4][4].hasMoved, true);

      const synced = await blackUpdate;
      assert.equal(synced.turnWhite, false);
      assert.equal(synced.board[4][4].t, 'P');
      assert.equal(synced.lastMove.from.r, 6);
      assert.equal(synced.lastMove.to.r, 4);
      await delay(50);
    } finally {
      white.disconnect();
      black.disconnect();
      server.kill();
    }
  }
);
