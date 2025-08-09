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

test('joinRoom clears lobby seat', { concurrency: false, timeout: 20000 }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');
  const env = {
    ...process.env,
    PORT: '3204',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1'
  };
  const server = await startServer(env);
  try {
    await fetch('http://localhost:3204/api/snake/table/seat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 'snake-2-100', accountId: 'p1', name: 'A', confirmed: true })
    });

    let res = await fetch('http://localhost:3204/api/snake/lobbies');
    let lobbies = await res.json();
    let lobby = lobbies.find(l => l.id === 'snake-2');
    assert.equal(lobby.players, 1);

    const s1 = io('http://localhost:3204');
    await new Promise((resolve) => s1.on('connect', resolve));
    s1.emit('joinRoom', { roomId: 'snake-2-100', accountId: 'p1', name: 'A' });
    await delay(500);

    res = await fetch('http://localhost:3204/api/snake/lobbies');
    lobbies = await res.json();
    lobby = lobbies.find(l => l.id === 'snake-2');
    assert.equal(lobby.players, 1);

    s1.disconnect();
  } finally {
    server.kill();
  }
});
