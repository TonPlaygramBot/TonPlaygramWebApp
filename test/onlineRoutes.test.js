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

test('online routes reflect pinged users', { concurrency: false }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3205',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1'
  };
  const server = await startServer(env);
  try {
    const pingRes = await fetch('http://localhost:3205/api/online/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 'player1', status: 'online' })
    });
    assert.equal(pingRes.status, 200);
    const ping = await pingRes.json();
    assert.equal(ping.success, true);

    const countRes = await fetch('http://localhost:3205/api/online/count');
    assert.equal(countRes.status, 200);
    const count = await countRes.json();
    assert.equal(count.count, 1);

    const listRes = await fetch('http://localhost:3205/api/online/list');
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.equal(list.users.length, 1);
    assert.equal(list.users[0].id, 'player1');
    assert.equal(list.users[0].status, 'online');
  } finally {
    server.kill();
  }
});
