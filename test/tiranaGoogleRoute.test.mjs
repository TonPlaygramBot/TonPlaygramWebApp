import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import router from '../bot/routes/tirana3d.js';

test('Google tile routes require a verified, fresh Telegram identity; never accept a claimed account ID', async () => {
  const names = [
    'GOOGLE_MAPS_TILE_API_KEY',
    'GOOGLE_MAPS_3D_ENABLED',
    'BOT_TOKEN',
    'API_AUTH_TOKEN'
  ];
  const saved = Object.fromEntries(names.map((k) => [k, process.env[k]]));
  process.env.GOOGLE_MAPS_TILE_API_KEY = 'private-test-key';
  process.env.GOOGLE_MAPS_3D_ENABLED = 'true';
  process.env.BOT_TOKEN = 'test-bot-token';
  delete process.env.API_AUTH_TOKEN;
  const app = express();
  app.use('/api/tirana-3d', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/tirana-3d`;
  const signed = (age) => {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000) - age),
      user: JSON.stringify({ id: 123 })
    });
    const input = [...params]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');
    const secret = crypto
      .createHmac('sha256', 'WebAppData')
      .update('test-bot-token')
      .digest();
    params.set(
      'hash',
      crypto.createHmac('sha256', secret).update(input).digest('hex')
    );
    return params.toString();
  };
  try {
    assert.equal((await fetch(base + '/config')).status, 401);
    assert.equal(
      (
        await fetch(base + '/config', {
          headers: { 'X-Tpc-Account-Id': 'someone-else' }
        })
      ).status,
      401
    );
    assert.equal(
      (
        await fetch(base + '/config', {
          headers: { 'X-Telegram-Init-Data': signed(90000) }
        })
      ).status,
      401
    );
    assert.equal(
      (
        await fetch(base + '/config', {
          headers: { 'X-Telegram-Init-Data': signed(-120) }
        })
      ).status,
      401
    );
    const headers = { 'X-Telegram-Init-Data': signed(1) };
    const config = await fetch(base + '/config', { headers });
    assert.equal(config.status, 200);
    const text = await config.text();
    assert.ok(!text.includes('private-test-key'));
    assert.equal(JSON.parse(text).enabled, true);
    assert.equal(
      (await fetch(base + '/tiles/v1/3dtiles/root.json')).status,
      401
    );
    assert.equal(
      (await fetch(base + '/tiles/v1/secrets', { headers })).status,
      400
    );
    assert.equal(
      (
        await fetch(base + '/tiles/v1/3dtiles/root.json?key=override', {
          headers
        })
      ).status,
      400
    );
    delete process.env.GOOGLE_MAPS_TILE_API_KEY;
    assert.equal((await (await fetch(base + '/config')).json()).enabled, false);
    assert.equal(
      (await fetch(base + '/tiles/v1/3dtiles/root.json', { headers })).status,
      503
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    for (const name of names)
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
  }
});
