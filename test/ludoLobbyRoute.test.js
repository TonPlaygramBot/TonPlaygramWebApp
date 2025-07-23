import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

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

test('ludo lobby route lists players', async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3203',
    MONGODB_URI: 'memory',
    SKIP_WEBAPP_BUILD: '1',
    BOT_TOKEN: 'dummy',
    SKIP_BOT_LAUNCH: '1'
  };
  const server = await startServer(env);
  try {
    for (let i = 0; i < 100; i++) {
      try {
        const res = await fetch('http://localhost:3203/api/ludo/lobby/ludo-2');
        if (res.ok) {
          const data = await res.json();
          assert.equal(data.id, 'ludo-2');
          assert.ok(Array.isArray(data.players));
          return;
        }
      } catch {}
      await delay(100);
    }
    assert.fail('lobby route not reachable');
  } finally {
    server.kill();
  }
});
