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

async function createAccount(port, telegramId) {
  const res = await fetch(`http://localhost:${port}/api/account/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegramId })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.accountId);
  return data.accountId;
}

async function getInventory(port, accountId) {
  const res = await fetch(`http://localhost:${port}/api/pool-royale/inventory/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.inventory);
  return data.inventory;
}

async function saveInventory(port, accountId, inventory) {
  const res = await fetch(`http://localhost:${port}/api/pool-royale/inventory/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, inventory })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.inventory);
  return data.inventory;
}

test(
  'Pool Royale inventory persists across reloads and devices',
  { concurrency: false },
  async () => {
    fs.mkdirSync(new URL('assets', distDir), { recursive: true });
    fs.writeFileSync(new URL('index.html', distDir), '');

    const env = {
      ...process.env,
      PORT: '3213',
      MONGO_URI: 'memory',
      BOT_TOKEN: 'dummy',
      SKIP_WEBAPP_BUILD: '1',
      SKIP_BOT_LAUNCH: '1'
    };
    const server = await startServer(env);
    try {
      const accountId = await createAccount(3213, 999991);
      const initialInventory = await getInventory(3213, accountId);

      const deviceAInventory = {
        ...initialInventory,
        clothColor: [...(initialInventory.clothColor || []), 'graphite'],
        cueStyle: [...(initialInventory.cueStyle || []), 'carbon-matrix']
      };
      const afterDeviceA = await saveInventory(3213, accountId, deviceAInventory);
      assert.ok(afterDeviceA.clothColor.includes('graphite'));
      assert.ok(afterDeviceA.cueStyle.includes('carbon-matrix'));

      const afterReload = await getInventory(3213, accountId);
      assert.ok(afterReload.clothColor.includes('graphite'));
      assert.ok(afterReload.cueStyle.includes('carbon-matrix'));

      const deviceBInventory = {
        tableFinish: ['jetBlackCarbon']
      };
      const afterDeviceB = await saveInventory(3213, accountId, deviceBInventory);
      assert.ok(afterDeviceB.tableFinish.includes('jetBlackCarbon'));
      assert.ok(afterDeviceB.cueStyle.includes('carbon-matrix'));

      const finalInventory = await getInventory(3213, accountId);
      assert.ok(finalInventory.tableFinish.includes('jetBlackCarbon'));
      assert.ok(finalInventory.clothColor.includes('graphite'));
      assert.ok(finalInventory.cueStyle.includes('carbon-matrix'));
    } finally {
      server.kill();
    }
  }
);
