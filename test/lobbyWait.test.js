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

test('joinRoom waits until table full', { concurrency: false, timeout: 20000 }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');
  const env = {
    ...process.env,
    PORT: '3203',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1'
  };
  const server = await startServer(env);
  try {
    await fetch('http://localhost:3203/api/snake/table/seat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 'snake-2-100', accountId: 'p1', name: 'A', confirmed: true })
    });

    const s1 = io('http://localhost:3203');
    const errors = [];
    await new Promise((resolve) => s1.on('connect', resolve));
    s1.on('error', (e) => errors.push(e));
    s1.emit('joinRoom', { roomId: 'snake-2-100', playerId: 'p1', name: 'A' });
    await delay(1500);
    assert.equal(errors.length, 0, 'should not error when table not full');
    s1.off('error');
    errors.length = 0;

    await fetch('http://localhost:3203/api/snake/table/seat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 'snake-2-100', accountId: 'p2', name: 'B', confirmed: true })
    });

    s1.emit('joinRoom', { roomId: 'snake-2-100', playerId: 'p1', name: 'A' });
    await delay(200);
    assert.equal(errors.length, 0, 'should join when table full');
    s1.disconnect();
  } finally {
    server.kill();
  }
});
