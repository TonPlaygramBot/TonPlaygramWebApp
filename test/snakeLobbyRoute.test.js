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

test('snake lobby route lists players', async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3200',
    MONGO_URI: 'memory',
    SKIP_WEBAPP_BUILD: '1',
    BOT_TOKEN: 'dummy'
  };
  const server = await startServer(env);
  try {
    for (let i = 0; i < 100; i++) {
      try {
        const res = await fetch('http://localhost:3200/api/snake/lobby/snake-2');
        if (res.ok) {
          const data = await res.json();
          assert.equal(data.id, 'snake-2');
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

test('snake lobby aggregates seated players by capacity', async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3201',
    MONGO_URI: 'memory',
    SKIP_WEBAPP_BUILD: '1',
    BOT_TOKEN: 'dummy'
  };
  const server = await startServer(env);
  try {
    await fetch('http://localhost:3201/api/snake/table/seat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableId: 'snake-2-custom',
        accountId: 'p-aggregate-1',
        name: 'Agg 1'
      })
    });

    for (let i = 0; i < 30; i++) {
      const res = await fetch('http://localhost:3201/api/snake/lobby/snake-2');
      if (res.ok) {
        const data = await res.json();
        const hasPlayer = data.players.some((p) => p.id === 'p-aggregate-1');
        if (hasPlayer) {
          assert.equal(data.capacity, 2);
          return;
        }
      }
      await delay(100);
    }
    assert.fail('Expected aggregated lobby to include seated player');
  } finally {
    server.kill();
  }
});
