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

test('players receive identical board on gameStarted', { concurrency: false, timeout: 20000 }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3205',
    MONGODB_URI: 'memory',
    BOT_TOKEN: 'dummy',
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1'
  };

  const server = await startServer(env);
  try {
    await fetch('http://localhost:3205/api/snake/table/seat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 'snake-2-100', accountId: 'p1', name: 'A', confirmed: true })
    });
    await fetch('http://localhost:3205/api/snake/table/seat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 'snake-2-100', accountId: 'p2', name: 'B', confirmed: true })
    });

    const s1 = io('http://localhost:3205');
    const s2 = io('http://localhost:3205');

    let board1; let board2;
    s1.on('gameStarted', (d) => { board1 = d; });
    s2.on('gameStarted', (d) => { board2 = d; });

    s1.emit('joinRoom', { roomId: 'snake-2-100', accountId: 'p1', name: 'A' });
    await delay(200);
    s2.emit('joinRoom', { roomId: 'snake-2-100', accountId: 'p2', name: 'B' });

    for (let i = 0; i < 100 && (!board1 || !board2); i++) {
      await delay(100);
    }

    s1.disconnect();
    s2.disconnect();

    assert.ok(board1 && board2, 'both players should get board');
    assert.deepEqual(board1, board2);
    assert.ok(Object.keys(board1.snakes || {}).length >= 1);
    assert.ok(Object.keys(board1.ladders || {}).length >= 1);
  } finally {
    server.kill();
  }
});
