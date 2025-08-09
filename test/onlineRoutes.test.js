import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';

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
  const env = {
    ...process.env,
    PORT: '3202',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1'
  };
  const server = await startServer(env);
  try {
    const pingRes = await fetch('http://localhost:3202/api/online/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'player1' })
    });
    assert.equal(pingRes.status, 200);
    const ping = await pingRes.json();
    assert.equal(ping.success, true);

    const countRes = await fetch('http://localhost:3202/api/online/count');
    assert.equal(countRes.status, 200);
    const count = await countRes.json();
    assert.equal(count.count, 1);

    const listRes = await fetch('http://localhost:3202/api/online/list');
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.deepEqual(list.users, ['player1']);
  } finally {
    server.kill();
  }
});
