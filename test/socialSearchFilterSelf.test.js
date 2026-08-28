import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';
import crypto from 'crypto';

const distDir = new URL('../webapp/dist/', import.meta.url);
const botToken = 'dummy';

function createInitData(id, token) {
  const params = new URLSearchParams();
  params.set('user', JSON.stringify({ id }));
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = crypto
    .createHmac('sha256', 'WebAppData')
    .update(token)
    .digest();
  const hash = crypto.createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex');
  params.set('hash', hash);
  return params.toString();
}

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

test('search excludes requesting user', { concurrency: false }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');
  const env = {
    ...process.env,
    PORT: '3208',
    MONGO_URI: 'memory',
    BOT_TOKEN: botToken,
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1'
  };
  const server = await startServer(env);
  try {
    await fetch('http://localhost:3208/api/profile/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': createInitData(1, botToken)
      },
      body: JSON.stringify({ telegramId: 1, firstName: 'Alice' })
    });
    await fetch('http://localhost:3208/api/profile/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': createInitData(2, botToken)
      },
      body: JSON.stringify({ telegramId: 2, firstName: 'Alicia' })
    });
    const res = await fetch('http://localhost:3208/api/social/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': createInitData(1, botToken)
      },
      body: JSON.stringify({ query: 'Ali', telegramId: 1 })
    });
    assert.equal(res.status, 200);
    const users = await res.json();
    assert.equal(users.length, 1);
    assert.equal(users[0].telegramId, 2);
  } finally {
    server.kill();
  }
});
