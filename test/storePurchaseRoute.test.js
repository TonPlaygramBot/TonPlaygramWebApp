import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'webapp', 'dist');
const apiToken = 'test-token';

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

async function createAccount(port, telegramId) {
  const res = await fetch(`http://localhost:${port}/api/account/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`
    },
    body: JSON.stringify({ telegramId })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  return data.accountId;
}

async function deposit(port, accountId, amount) {
  const res = await fetch(`http://localhost:${port}/api/account/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`
    },
    body: JSON.stringify({ accountId, amount, game: 'test' })
  });
  assert.equal(res.status, 200);
}

test('account store-purchase accepts gift-style fromAccount payload', async () => {
  fs.mkdirSync(path.join(distDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(distDir, 'index.html'), '');

  const env = {
    ...process.env,
    PORT: '3215',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    API_AUTH_TOKEN: apiToken,
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1'
  };

  const server = await startServer(env);
  try {
    const accountId = await createAccount(3215, 999992);
    await deposit(3215, accountId, 500);

    const purchaseRes = await fetch('http://localhost:3215/api/account/store-purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`
      },
      body: JSON.stringify({
        fromAccount: accountId,
        bundle: {
          items: [{ slug: 'poolroyale', type: 'cueStyle', optionId: 'carbon-matrix', price: 100 }]
        }
      })
    });

    assert.equal(purchaseRes.status, 200);
    const purchaseData = await purchaseRes.json();
    assert.equal(purchaseData.balance, 400);
    assert.equal(purchaseData.transaction?.type, 'storefront');
  } finally {
    server.kill();
  }
}, 20000);
