import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';

const distDir = new URL('../webapp/dist/', import.meta.url);
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

test('claiming a referral updates inviter stats', { concurrency: false, timeout: 20000 }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3210',
    MONGO_URI: 'memory',
    SKIP_WEBAPP_BUILD: '1',
    BOT_TOKEN: 'dummy',
    API_AUTH_TOKEN: apiToken,
    SKIP_BOT_LAUNCH: '1'
  };
  const server = await startServer(env);
  try {
    const inviterId = '1111';
    const userId = '2222';

    const codeRes = await fetch('http://localhost:3210/api/referral/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: inviterId })
    });
    assert.equal(codeRes.status, 200);
    const inviterInfo = await codeRes.json();
    assert.ok(inviterInfo.referralCode);
    assert.equal(inviterInfo.referralCount, 0);
    assert.equal(inviterInfo.bonusMiningRate, 0);

    const claimRes = await fetch('http://localhost:3210/api/referral/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: userId, code: inviterInfo.referralCode })
    });
    assert.equal(claimRes.status, 200);
    const claim = await claimRes.json();
    assert.equal(claim.message, 'claimed');
    assert.equal(claim.total, 1);

    const updatedRes = await fetch('http://localhost:3210/api/referral/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: inviterId })
    });
    assert.equal(updatedRes.status, 200);
    const updated = await updatedRes.json();
    assert.equal(updated.referralCount, 1);
    assert.equal(updated.bonusMiningRate, 0.1);

    const inviterAccRes = await fetch('http://localhost:3210/api/account/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`
      },
      body: JSON.stringify({ telegramId: inviterId })
    });
    const inviterAcc = await inviterAccRes.json();
    assert.ok(inviterAcc.walletAddress);
    const inviterInfoRes = await fetch('http://localhost:3210/api/account/info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`
      },
      body: JSON.stringify({ accountId: inviterAcc.accountId })
    });
    const inviterAccount = await inviterInfoRes.json();
    assert.equal(inviterAccount.balance, 5000);
    assert.equal(inviterAccount.transactions[0].type, 'referral');
    assert.equal(inviterAccount.transactions[0].amount, 5000);

    const userAccRes = await fetch('http://localhost:3210/api/account/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`
      },
      body: JSON.stringify({ telegramId: userId })
    });
    const userAcc = await userAccRes.json();
    assert.ok(userAcc.walletAddress);
    const userInfoRes = await fetch('http://localhost:3210/api/account/info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`
      },
      body: JSON.stringify({ accountId: userAcc.accountId })
    });
    const userAccount = await userInfoRes.json();
    assert.equal(userAccount.balance, 5000);
    assert.equal(userAccount.transactions[0].type, 'referral');
    assert.equal(userAccount.transactions[0].amount, 5000);
  } finally {
    server.kill();
  }
});
