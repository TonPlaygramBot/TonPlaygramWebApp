import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';
import { io } from 'socket.io-client';

const distDir = new URL('../webapp/dist/', import.meta.url);

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

test('snake API endpoints and socket events', { concurrency: false, timeout: 20000 }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3201',
    MONGODB_URI: 'memory',
    SKIP_BOT_LAUNCH: '1',
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
    s2.emit('joinRoom', { roomId: 'snake-2', playerId: 'p2', name: 'B' });

    for (let i = 0; i < 50 && !events.includes('gameStarted'); i++) {
      await delay(100);
    }
    s1.emit('rollDice');
    for (let i = 0; i < 50 && !events.includes('diceRolled'); i++) {
      await delay(100);
    }
    s1.disconnect();
    s2.disconnect();
    assert.ok(events.includes('diceRolled'));
  } finally {
    server.kill();
  }
});
