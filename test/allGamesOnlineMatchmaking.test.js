import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';
import { io } from 'socket.io-client';
import net from 'node:net';

const apiToken = 'all-games-test-token';
const distDir = new URL('../webapp/dist/', import.meta.url);

const games = [
  { gameType: 'chess', maxPlayers: 2, matchMeta: {} },
  { gameType: 'domino-royal', maxPlayers: 4, matchMeta: { variant: 'points', targetPoints: 101 } },
  { gameType: 'poolroyale', maxPlayers: 2, matchMeta: { variant: '8ball', tableSize: '9ft' } },
  { gameType: 'snookerroyale', maxPlayers: 2, matchMeta: { playType: 'regular', tableSize: '12ft' } },
  { gameType: 'snake', maxPlayers: 4, matchMeta: {} },
  { gameType: 'ludobattleroyal', maxPlayers: 3, matchMeta: { variant: 'classic' } },
  { gameType: 'ludobattleroyal', maxPlayers: 4, matchMeta: { variant: 'classic' } },
  { gameType: 'fourinrow', maxPlayers: 2, matchMeta: { boardSize: '7x6' } },
  { gameType: 'checkers', maxPlayers: 2, matchMeta: {} },
  { gameType: 'backgammon', maxPlayers: 2, matchMeta: {} },
  { gameType: 'texasholdem', maxPlayers: 8, matchMeta: { tableSize: 8, gameMode: 'standard', buyIn: 100 } },
  { gameType: 'airhockey', maxPlayers: 2, matchMeta: { winScore: 11, arena: 'regular' } },
  { gameType: 'murlanroyale', maxPlayers: 4, matchMeta: { variant: 'single', players: 4, rules: 'single' } },
  { gameType: 'black-tide', maxPlayers: 2, matchMeta: { format: 'co-op-campaign', campaign: 'black-tide' } }
];

function waitForEvent(socket, event, predicate = () => true, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`${event} timed out for ${socket.id || 'disconnected socket'}`));
    }, timeoutMs);
    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

async function getFreePort() {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

test('Test 1 through Test 8 receive identical lobby and game-start state in every online game', { timeout: 60000 }, async () => {
  const port = await getFreePort();
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');
  const server = spawn('node', ['bot/server.js'], {
    env: {
      ...process.env,
      PORT: String(port),
      MONGO_URI: 'memory',
      BOT_TOKEN: 'dummy',
      API_AUTH_TOKEN: apiToken,
      SKIP_WEBAPP_BUILD: '1',
      SKIP_BOT_LAUNCH: '1',
      SKIP_CHESS_STAKE_RESERVATION: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const output = [];
  server.stdout.on('data', (chunk) => output.push(chunk.toString()));
  server.stderr.on('data', (chunk) => output.push(chunk.toString()));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(output.join(''))), 10000);
    server.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Server running on port')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  for (let index = 1; index <= 8; index += 1) {
    const response = await fetch(`http://localhost:${port}/api/account/deposit`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ accountId: `test-${index}`, amount: 10000, game: 'online-qa' })
    });
    const responseBody = await response.text();
    assert.equal(response.ok, true, `Could not fund Test ${index}: ${response.status} ${responseBody}`);
  }

  try {
    for (let gameIndex = 0; gameIndex < games.length; gameIndex += 1) {
      const game = games[gameIndex];
      const sockets = Array.from({ length: game.maxPlayers }, () =>
        io(`http://localhost:${port}`, { auth: { token: apiToken }, forceNew: true })
      );
      try {
        await Promise.all(sockets.map((socket) => waitForEvent(socket, 'connect')));
        await Promise.all(sockets.map((socket, index) => emitAck(socket, 'register', {
          tpcAccountNumber: `test-${index + 1}`,
          accountId: `test-${index + 1}`,
          playerId: `test-${index + 1}`
        })));

        const fullLobbyPromises = sockets.map((socket) => waitForEvent(
          socket,
          'lobbyUpdate',
          (payload) => payload?.players?.length === game.maxPlayers
        ));
        const gameStartPromises = sockets.map((socket) => waitForEvent(
          socket,
          'gameStart',
          (payload) => payload?.players?.length === game.maxPlayers
        ));
        const seats = [];
        for (let index = 0; index < sockets.length; index += 1) {
          const accountId = `test-${index + 1}`;
          const response = await emitAck(sockets[index], 'seatTable', {
            tpcAccountNumber: accountId,
            accountId,
            playerId: accountId,
            playerName: `Test ${index + 1}`,
            gameType: game.gameType,
            stake: 100 + gameIndex,
            maxPlayers: game.maxPlayers,
            mode: 'online',
            token: 'TPG',
            matchMeta: { ...game.matchMeta, mode: 'online', token: 'TPG' }
          });
          assert.equal(response?.success, true, `${game.gameType}: Test ${index + 1} was not seated (${response?.error})`);
          seats.push(response);
        }
        const tableId = seats[0].tableId;
        assert.ok(seats.every((seat) => seat.tableId === tableId), `${game.gameType}: players were split across tables`);
        await Promise.all(fullLobbyPromises);
        sockets.forEach((socket, index) => socket.emit('confirmReady', {
          tpcAccountNumber: `test-${index + 1}`,
          accountId: `test-${index + 1}`,
          tableId
        }));
        const starts = await Promise.all(gameStartPromises).catch((error) => {
          throw new Error(`${game.gameType}: ${error.message}\n${output.slice(-20).join('')}`);
        });
        for (const start of starts) {
          assert.equal(start.tableId, tableId);
          assert.deepEqual(
            start.players.map((player) => player.name),
            Array.from({ length: game.maxPlayers }, (_, index) => `Test ${index + 1}`)
          );
        }
        if (game.gameType === 'ludobattleroyal') {
          const initialStates = sockets.map((socket) => waitForEvent(
            socket,
            'ludoBattleState',
            (payload) => payload?.tableId === tableId && payload.state?.revision === 0
          ));
          await Promise.all(sockets.map((socket, index) => emitAck(socket, 'joinLudoBattleTable', {
            tableId,
            accountId: `test-${index + 1}`
          })));
          const joinedStates = await Promise.all(initialStates);
          assert.ok(joinedStates.every((payload) =>
            payload.state.players.join('|') === joinedStates[0].state.players.join('|')
          ), `${game.gameType}: clients did not join the same authoritative board`);

          const rolledStates = sockets.map((socket) => waitForEvent(
            socket,
            'ludoBattleState',
            (payload) => payload?.tableId === tableId && payload.state?.revision === 1
          ));
          const roll = await emitAck(sockets[0], 'ludoBattleRoll', {
            tableId,
            accountId: 'test-1'
          });
          assert.equal(roll.success, true);
          const syncedStates = await Promise.all(rolledStates);
          assert.ok(syncedStates.every((payload) =>
            JSON.stringify(payload.state) === JSON.stringify(syncedStates[0].state)
          ), `${game.gameType}: dice state was not synchronized to every board`);
        }
        if (game.gameType === 'fourinrow') {
          const initialStates = sockets.map((socket) => waitForEvent(
            socket,
            'fourInRowState',
            (state) => state?.tableId === tableId && state.revision === 0
          ));
          await Promise.all(sockets.map((socket, index) => emitAck(socket, 'joinFourInRow', {
            tableId,
            accountId: `test-${index + 1}`
          })));
          await Promise.all(initialStates);
          const movedStates = sockets.map((socket) => waitForEvent(
            socket,
            'fourInRowState',
            (state) => state?.tableId === tableId && state.revision === 1
          ));
          const move = await emitAck(sockets[0], 'fourInRowMove', {
            tableId,
            accountId: 'test-1',
            column: 3
          });
          assert.equal(move.success, true);
          const synced = await Promise.all(movedStates);
          assert.ok(synced.every((state) => state.board[5][3] === 0));
          assert.ok(synced.every((state) => state.turn === 'test-2'));
        }
      } finally {
        sockets.forEach((socket) => socket.disconnect());
      }
    }
  } finally {
    server.kill('SIGTERM');
    await new Promise((resolve) => {
      if (server.exitCode != null) return resolve();
      const timer = setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 3000);
      server.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
});
