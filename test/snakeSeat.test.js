import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';

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

test('seat and unseat endpoints update lobby', { concurrency: false, timeout: 20000 }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3206',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    SKIP_WEBAPP_BUILD: '1'
  };

  const server = await startServer(env);
  try {
    let res = await fetch('http://localhost:3206/api/snake/table/seat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 'snake-2', playerId: 'p100', name: 'Tester' })
    });
    assert.equal(res.status, 200);

    res = await fetch('http://localhost:3206/api/snake/lobby/snake-2');
    assert.equal(res.status, 200);
    let lobby = await res.json();
    assert.ok(lobby.players.some(p => p.id === 'p100' && p.name === 'Tester'));

    res = await fetch('http://localhost:3206/api/snake/table/unseat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 'snake-2', playerId: 'p100' })
    });
    assert.equal(res.status, 200);

    let removed = false;
    const deadline = Date.now() + 2000;
    while (!removed && Date.now() < deadline) {
      res = await fetch('http://localhost:3206/api/snake/lobby/snake-2');
      assert.equal(res.status, 200);
      lobby = await res.json();
      removed = !lobby.players.some(p => p.id === 'p100');
      if (!removed) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    assert.ok(removed);
  } finally {
    server.kill();
  }
});
