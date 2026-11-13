import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import matchmaking from '../bot/routes/matchmaking.js';
import User from '../bot/models/User.js';
import { createAuthSession } from '../bot/utils/authSession.js';

test('matchmaking service authentication also requires verified player ownership', async () => {
  const previousSecret = process.env.MATCHMAKING_SERVICE_SECRET;
  const previousSessionSecret = process.env.AUTH_SESSION_SECRET;
  process.env.MATCHMAKING_SERVICE_SECRET = 'test-gateway-secret';
  process.env.AUTH_SESSION_SECRET = 'independent-session-secret-with-more-than-32-characters';
  const originalFindOne = User.findOne;
  const lookups = [];
  let storedUser = { accountId: 'owner-account', googleId: 'owner-google', tpcAccountNumber: 'TPG-OWNER', balance: 25, firstName: 'Owner' };
  User.findOne = (selector) => {
    lookups.push(selector);
    return { lean: async () => storedUser };
  };
  const app = express();
  app.use(express.json());
  app.use('/api/matchmaking', matchmaking);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/matchmaking/session`;
  const post = (body, serviceSecret = 'test-gateway-secret') => fetch(base, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-matchmaking-secret': serviceSecret }, body: JSON.stringify(body)
  });
  try {
    const sessionToken = createAuthSession({ accountId: 'owner-account', googleId: 'owner-google' });
    assert.equal((await post({ sessionToken }, 'wrong-service')).status, 401);
    assert.equal((await post({ accountId: 'victim-account', googleId: 'victim-google' })).status, 401);
    assert.equal(lookups.length, 0, 'client identity claims never reach the user lookup');

    const response = await post({ sessionToken, accountId: 'victim-account', googleId: 'victim-google' });
    assert.equal(response.status, 200);
    assert.deepEqual(lookups, [{ accountId: 'owner-account' }]);
    assert.equal((await response.json()).tpcAccountNumber, 'TPG-OWNER');

    storedUser = { ...storedUser, isBanned: true };
    assert.equal((await post({ sessionToken })).status, 401);
    storedUser = null;
    assert.equal((await post({ sessionToken })).status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    User.findOne = originalFindOne;
    if (previousSecret === undefined) delete process.env.MATCHMAKING_SERVICE_SECRET; else process.env.MATCHMAKING_SERVICE_SECRET = previousSecret;
    if (previousSessionSecret === undefined) delete process.env.AUTH_SESSION_SECRET; else process.env.AUTH_SESSION_SECRET = previousSessionSecret;
  }
});
