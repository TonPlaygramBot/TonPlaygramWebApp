import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';
import { io as client } from 'socket.io-client';

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
    const socket = client('http://localhost:3200');
    socket.emit('joinRoom', { roomId: 'snake-2', playerId: 'p1', name: 'A' });
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch('http://localhost:3200/api/snake/lobby/snake-2');
        if (res.ok) {
          const data = await res.json();
          if (data.players.length > 0) {
            assert.equal(data.players[0].id, 'p1');
            socket.close();
            return;
          }
        }
      } catch {}
      await delay(100);
    }
    assert.fail('lobby did not report players');
  } finally {
    server.kill();
  }
});
