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

test('social routes support linked account auth and exclude the requesting user', { concurrency: false }, async () => {
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
    const recipientProfileResponse = await fetch('http://localhost:3208/api/profile/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': createInitData(2, botToken)
      },
      body: JSON.stringify({ telegramId: 2, firstName: 'Alicia' })
    });
    await recipientProfileResponse.json();
    assert.equal(recipientProfileResponse.status, 200);
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

    const linkedProfileResponse = await fetch('http://localhost:3208/api/profile/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: 2 })
    });
    const recipientProfile = await linkedProfileResponse.json();
    assert.ok(recipientProfile.accountId);

    const createRequest = async () => {
      const response = await fetch('http://localhost:3208/api/social/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': createInitData(1, botToken)
        },
        body: JSON.stringify({ fromId: 1, toId: 2 })
      });
      assert.equal(response.status, 200);
      return response.json();
    };
    const respondAsLinkedAccount = (action, requestId) => fetch(
      `http://localhost:3208/api/social/${action}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tpc-account-id': recipientProfile.accountId
        },
        body: JSON.stringify({ requestId })
      }
    );

    const firstRequest = await createRequest();
    const rejectResponse = await respondAsLinkedAccount('reject', firstRequest._id);
    assert.equal(rejectResponse.status, 200);
    assert.equal((await rejectResponse.json()).status, 'rejected');

    const repeatedRequest = await createRequest();
    const acceptResponse = await respondAsLinkedAccount('accept', repeatedRequest._id);
    assert.equal(acceptResponse.status, 200);
    assert.equal((await acceptResponse.json()).status, 'accepted');
  } finally {
    server.kill();
  }
});
