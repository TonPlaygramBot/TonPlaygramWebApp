import test from 'node:test';

import assert from 'node:assert/strict';

import fs from 'fs';

import { spawn } from 'child_process';

import { setTimeout as delay } from 'timers/promises';

import { io } from 'socket.io-client';

import { GameRoom, DEFAULT_SNAKES, DEFAULT_LADDERS } from '../bot/gameEngine.js';

const distDir = new URL('../webapp/dist/', import.meta.url);

class DummyIO {

  constructor() {

    this.events = [];

  }

  to() {

    return { emit: (e, d) => this.events.push({ event: e, data: d }) };

  }

}

test('other players receive move and turn events', () => {

  const io = new DummyIO();

  const room = new GameRoom('r', io, 2, {

    snakes: DEFAULT_SNAKES,

    ladders: DEFAULT_LADDERS,

  });

  room.rollCooldown = 0;

  const s1 = { id: 's1', join: () => {}, emit: () => {} };

  const s2 = { id: 's2', join: () => {}, emit: () => {} };

  room.addPlayer('p1', 'A', s1);

  room.addPlayer('p2', 'B', s2);

  room.startGame();

  io.events = [];

  room.rollDice(s1, [6, 2]);

  const move = io.events.find(e => e.event === 'movePlayer');

  const turn = io.events.find(e => e.event === 'turnChanged' && e.data.playerId === 'p2');

  assert.ok(move, 'movePlayer should be emitted');

  assert.ok(turn, 'turnChanged should indicate player 2');

});

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

test.skip('snake API endpoints and socket events', { concurrency: false, timeout: 20000 }, async () => {

  fs.mkdirSync(new URL('assets', distDir), { recursive: true });

  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {

    ...process.env,

    PORT: '3201',

    MONGO_URI: 'memory',
    BOT_TOKEN: "dummy",

    SKIP_WEBAPP_BUILD: '1'

  };

  const server = await startServer(env);

  try {

    const lobbyRes = await fetch('http://localhost:3201/api/snake/lobbies');

    assert.equal(lobbyRes.status, 200);

    const lobbies = await lobbyRes.json();

    assert.ok(Array.isArray(lobbies));

    assert.ok(lobbies.every((l) => l.id && l.capacity));

    const boardRes = await fetch('http://localhost:3201/api/snake/board/snake-2');

    assert.equal(boardRes.status, 200);

    const board = await boardRes.json();

    assert.ok(board.snakes && board.ladders);

    const s1 = io('http://localhost:3201');

    const s2 = io('http://localhost:3201');

    const events = [];

    s1.onAny((e) => events.push(e));

    s2.onAny((e) => events.push(e));

    s1.emit('joinRoom', { roomId: 'snake-2', playerId: 'p1', name: 'A' });
    await delay(200);

    s2.emit('joinRoom', { roomId: 'snake-2', playerId: 'p2', name: 'B' });

    for (let i = 0; i < 50 && !events.includes('boardData'); i++) {
      await delay(100);
    }

    for (let i = 0; i < 100 && !events.includes('gameStarted'); i++) {

      await delay(100);

    }

    s1.emit('rollDice');

    for (let i = 0; i < 100 && !events.includes('diceRolled'); i++) {

      await delay(100);

    }

    const resRes = await fetch('http://localhost:3201/api/snake/results?limit=1');
    assert.equal(resRes.status, 200);
    const resData = await resRes.json();
    assert.ok(Array.isArray(resData.results));

    const lbRes = await fetch('http://localhost:3201/api/snake/results?leaderboard=true');
    assert.equal(lbRes.status, 200);
    const lbData = await lbRes.json();
    assert.ok(Array.isArray(lbData.leaderboard));

    s1.disconnect();

    s2.disconnect();

    assert.ok(events.includes('diceRolled'));
    assert.ok(events.includes('boardData'));

  } finally {

    server.kill();

  }

});