import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { signRewardReceipt } from '../bot/utils/rewardReceipt.js';

const distDir = new URL('../webapp/dist/', import.meta.url);
process.env.REWARD_SIGNING_SECRET = 'test-reward-secret';

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

async function deposit(port, token, apiToken, telegramId, amount) {
  const ts = Date.now();
  const nonce = crypto.randomUUID();
  const receipt = signRewardReceipt(
    { purpose: 'wallet_deposit', telegramId, amount, nonce, ts },
    process.env.REWARD_SIGNING_SECRET
  );
  const res = await fetch(`http://localhost:${port}/api/wallet/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ telegramId, amount, receipt, nonce, ts }),
  });
  assert.equal(res.status, 200);
  await res.json();
}

test('withdraw route reverts balance on claim failure', { concurrency: false }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3211',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    WITHDRAW_ENABLED: 'true',
    API_AUTH_TOKEN: 'test-admin',
    REWARD_SIGNING_SECRET: 'test-reward-secret',
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1',
  };
  const server = await startServer(env);
  try {
    await deposit(3211, 'dummy', 'test-admin', 1111, 100);
    const res = await fetch('http://localhost:3211/api/wallet/withdraw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': createInitData(1111, 'dummy'),
      },
      body: JSON.stringify({ telegramId: 1111, address: 'EQfake', amount: 50 }),
    });
    assert.equal(res.status, 500);
    const err = await res.json();
    assert.equal(err.error, 'claim failed');
    const balRes = await fetch('http://localhost:3211/api/wallet/balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': createInitData(1111, 'dummy'),
      },
      body: JSON.stringify({ telegramId: 1111 }),
    });
    assert.equal(balRes.status, 200);
    const bal = await balRes.json();
    assert.equal(bal.balance, 100);
  } finally {
    server.kill();
  }
});

test('claim-external route reverts balance on claim failure', { concurrency: false }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3212',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    WITHDRAW_ENABLED: 'true',
    API_AUTH_TOKEN: 'test-admin',
    REWARD_SIGNING_SECRET: 'test-reward-secret',
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1',
  };
  const server = await startServer(env);
  try {
    await deposit(3212, 'dummy', 'test-admin', 2222, 100);
    const res = await fetch('http://localhost:3212/api/wallet/claim-external', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': createInitData(2222, 'dummy'),
      },
      body: JSON.stringify({ telegramId: 2222, address: 'EQfake', amount: 50 }),
    });
    assert.equal(res.status, 500);
    const err = await res.json();
    assert.equal(err.error, 'claim failed');
    const balRes = await fetch('http://localhost:3212/api/wallet/balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': createInitData(2222, 'dummy'),
      },
      body: JSON.stringify({ telegramId: 2222 }),
    });
    assert.equal(balRes.status, 200);
    const bal = await balRes.json();
    assert.equal(bal.balance, 100);
  } finally {
    server.kill();
  }
});
