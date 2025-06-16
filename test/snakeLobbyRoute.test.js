import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

const distDir = new URL('../webapp/dist/', import.meta.url);

async function startServer(env) {
  return spawn('node', ['bot/server.js'], { env, stdio: 'pipe' });
}

test('snake lobby route lists players', async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3200',
    MONGODB_URI: 'memory',
    SKIP_BOT_LAUNCH: '1'
  };
  const server = await startServer(env);
  try {
    for (let i = 0; i < 20; i++) {
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
