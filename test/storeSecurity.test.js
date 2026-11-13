import express from 'express';
import storeRouter from '../bot/routes/store.js';

let server;
let baseUrl;
const oldToken = process.env.API_AUTH_TOKEN;
const apiToken = 'store-security-test-token';

beforeAll(async () => {
  process.env.API_AUTH_TOKEN = apiToken;
  const app = express();
  app.use(express.json());
  app.use(storeRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  if (oldToken === undefined) delete process.env.API_AUTH_TOKEN;
  else process.env.API_AUTH_TOKEN = oldToken;
});

test.each(['/purchase', '/purchase-v2'])(
  '%s rejects zero-price client-selected unlocks even with a server credential', async (path) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
      body: JSON.stringify({
        accountId: 'victim-account',
        bundle: { items: [{ slug: 'poolroyale', type: 'cueStyle', optionId: 'carbon-matrix', price: 0 }] }
      })
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'verified_settlement_required' });
  }
);

test('store purchase does not accept an account ID as login proof', async () => {
  const response = await fetch(`${baseUrl}/purchase-v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tpc-Account-Id': 'victim-account' },
    body: JSON.stringify({ accountId: 'victim-account', bundle: { items: [] } })
  });
  expect(response.status).toBe(401);
});
