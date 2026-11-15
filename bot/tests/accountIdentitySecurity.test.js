import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

process.env.BOT_TOKEN = '123456:identity-test-token';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.MONGO_URI = 'memory';
// Receipt rendering and Telegram delivery are unrelated to identity guards.
// Run with node --experimental-test-module-mocks --test this-file.
mock.module('../bot.js', { defaultExport: { telegram: { sendMessage: async () => {} } } });
mock.module('../utils/notifications.js', { namedExports: {
  sendTransferNotification: async () => {}, sendGiftNotification: async () => {},
  sendDepositNotification: async () => {}, sendStorePurchaseNotification: async () => {}
} });
const { default: accounts } = await import('../routes/account.js');
const { default: profiles } = await import('../routes/profile.js');
const { default: User } = await import('../models/User.js');
const { createMemoryUser, findMemoryUser } = await import('../utils/memoryUserStore.js');

const route = (router, path) => router.stack.find((layer) => layer.route?.path === path).route.stack.at(-1).handle;
function request(body, headers = {}) { return { body, get: (key) => headers[key.toLowerCase()], auth: {} }; }
function response() {
  return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, setHeader(key, value) { this.headers[key] = value; } };
}
function telegram(id, age = 0) {
  const params = new URLSearchParams({ user: JSON.stringify({ id }), auth_date: String(Math.floor(Date.now() / 1000) - age) });
  const secret = createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
  const data = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  params.set('hash', createHmac('sha256', secret).update(data).digest('hex'));
  return params.toString();
}
function mockGoogle(id) {
  return mock.method(OAuth2Client.prototype, 'verifyIdToken', async ({ idToken, audience }) => {
    assert.equal(idToken, 'signed-google-token');
    assert.deepEqual(audience, [process.env.GOOGLE_CLIENT_ID]);
    return { getPayload: () => ({ sub: id, aud: process.env.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', exp: Math.floor(Date.now() / 1000) + 300, iat: Math.floor(Date.now() / 1000) }) };
  });
}

test('account create rejects compatibility Google headers without a signed token', async () => {
  const res = response();
  await route(accounts, '/create')(request({ googleId: 'victim' }, { 'x-google-id': 'victim', 'x-tpc-account-id': 'victim-account' }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'reauthentication_required');
});

test('valid Telegram identity cannot claim an unverified Google subject during creation', async () => {
  const res = response();
  await route(accounts, '/create')(request({ telegramId: 501, googleId: 'victim' }, { 'x-telegram-init-data': telegram(501), 'x-google-id': 'victim' }), res);
  assert.equal(res.statusCode, 403);
});

test('create resolves the credential owner and ignores another account-id hint', async () => {
  const google = mockGoogle('owner-google');
  try {
    createMemoryUser({ accountId: 'owner-account', googleId: 'owner-google', walletAddress: 'owner-wallet', firstName: 'Owner' });
    createMemoryUser({ accountId: 'victim-account', googleId: 'victim-google', walletAddress: 'victim-wallet', firstName: 'Victim' });
    const res = response();
    await route(accounts, '/create')(request({ googleId: 'owner-google', accountId: 'victim-account', firstName: 'Updated owner' }, { 'x-google-id-token': 'signed-google-token', 'x-tpc-account-id': 'victim-account' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.accountId, 'owner-account');
    assert.equal(findMemoryUser({ accountId: 'victim-account' }).firstName, 'Victim');
    assert.equal(res.headers['Cache-Control'], 'no-store');
  } finally { google.mock.restore(); }
});

test('a valid new sign-in receives a server-generated account id', async () => {
  const google = mockGoogle('new-owner-google');
  try {
    const res = response();
    await route(accounts, '/create')(request({ googleId: 'new-owner-google', accountId: 'victim-account' }, { 'x-google-id-token': 'signed-google-token' }), res);
    assert.equal(res.statusCode, 200);
    assert.notEqual(res.body.accountId, 'victim-account');
    assert.match(res.body.accountId, /^[0-9a-f-]{36}$/);
    assert.equal(findMemoryUser({ googleId: 'new-owner-google' }).accountId, res.body.accountId);
  } finally { google.mock.restore(); }
});

test('register-google and transaction creation reject unverified identity headers', async () => {
  for (const [path, body] of [['/register-google', { googleId: 'victim' }], ['/addTransaction', { accountId: 'victim-account', amount: 1, type: 'test' }]]) {
    const res = response();
    const req = request(body, { 'x-google-id': 'victim' });
    req.auth = { googleId: 'victim', accountId: 'victim-account' };
    await route(profiles, path)(req, res);
    assert.equal(res.statusCode, 401, path);
  }
});

test('Google linking needs proof of both sign-ins and rejects stale Telegram data', async () => {
  for (const headers of [
    { 'x-google-id': 'victim', 'x-tpc-account-id': 'victim-account' },
    { 'x-telegram-init-data': telegram(501) },
    { 'x-telegram-init-data': telegram(501, 90000), 'x-google-id-token': 'signed-google-token' }
  ]) {
    const res = response();
    await route(profiles, '/link-google')(request({ telegramId: 501, googleId: 'victim' }, headers), res);
    assert.ok([401, 403].includes(res.statusCode));
  }
});

test('verified linking refuses to merge separate existing accounts', async () => {
  const google = mockGoogle('owner-google');
  const query = mock.method(User, 'findOne', (filter) => Promise.resolve(filter.telegramId ? { _id: 'telegram-user', accountId: 'telegram-account' } : { _id: 'different-google-user', accountId: 'google-account' }));
  const update = mock.method(User, 'findOneAndUpdate', () => { throw new Error('Must not mutate another user'); });
  try {
    const res = response();
    await route(profiles, '/link-google')(request({ telegramId: 501, googleId: 'owner-google' }, { 'x-telegram-init-data': telegram(501), 'x-google-id-token': 'signed-google-token' }), res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error, 'identity_already_linked');
    assert.equal(update.mock.callCount(), 0);
  } finally { google.mock.restore(); query.mock.restore(); update.mock.restore(); }
});

test('identity selectors reject objects and mismatched signed Telegram identities', async () => {
  for (const body of [{ telegramId: { $ne: null } }, { googleId: { $ne: null } }, { telegramId: 999 }]) {
    const res = response();
    await route(accounts, '/create')(request(body, { 'x-telegram-init-data': telegram(501) }), res);
    assert.ok([400, 403].includes(res.statusCode));
  }
});

test('linking proven sign-ins only updates the verified Telegram account', async () => {
  const google = mockGoogle('new-link-google');
  const existing = { _id: 'verified-user', accountId: 'verified-account', telegramId: 501, photoCustom: true, photo: 'custom-photo' };
  const query = mock.method(User, 'findOne', (filter) => Promise.resolve(filter.telegramId ? existing : null));
  const update = mock.method(User, 'findOneAndUpdate', async (filter, operation, options) => {
    assert.deepEqual(filter, { _id: 'verified-user', telegramId: 501 });
    assert.equal(operation.$set.googleId, 'new-link-google');
    assert.equal(operation.$set.photo, undefined);
    assert.equal(options.upsert, undefined);
    return { ...existing, ...operation.$set };
  });
  try {
    const res = response();
    await route(profiles, '/link-google')(request({ telegramId: 501, googleId: 'new-link-google', photo: 'replace-photo', accountId: 'victim-account' }, { 'x-telegram-init-data': telegram(501), 'x-google-id-token': 'signed-google-token', 'x-tpc-account-id': 'victim-account' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.accountId, 'verified-account');
    assert.equal(update.mock.callCount(), 1);
  } finally { google.mock.restore(); query.mock.restore(); update.mock.restore(); }
});


test('account refresh without a proved identity does not create a guest account', async () => {
  const res = response();
  await route(accounts, '/create')(request({ accountId: 'owner-account', walletAddress: 'unproved-wallet' }, { 'x-tpc-account-id': 'owner-account' }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.accountId, undefined);
});

test('linked Telegram and Google credentials restore the same stable account', async () => {
  const google = mockGoogle('linked-google');
  try {
    createMemoryUser({ accountId: 'linked-account', googleId: 'linked-google', telegramId: 701, walletAddress: 'linked-wallet' });
    const headers = { 'x-google-id-token': 'signed-google-token', 'x-telegram-init-data': telegram(701) };
    for (let i = 0; i < 2; i += 1) {
      const res = response();
      await route(accounts, '/create')(request({ telegramId: 701, googleId: 'linked-google', accountId: 'old-account-hint' }, headers), res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.accountId, 'linked-account');
      assert.equal(res.body.walletAddress, 'linked-wallet');
    }
  } finally { google.mock.restore(); }
});
