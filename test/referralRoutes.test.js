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

test('claiming a referral updates inviter stats', { concurrency: false }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3210',
    MONGODB_URI: 'memory',
    SKIP_WEBAPP_BUILD: '1',
    BOT_TOKEN: 'dummy'
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
  } finally {
    server.kill();
  }
});
