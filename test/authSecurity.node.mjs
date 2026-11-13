import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import authenticate, { optionalAuthenticate, verifyTelegramInitData, resolveAuthCredentials, TELEGRAM_AUTH_MAX_AGE_SECONDS } from '../bot/middleware/auth.js';
import { createAuthSession, verifyAuthSession, AUTH_SESSION_TTL_SECONDS } from '../bot/utils/authSession.js';
import { authenticateSocketHandshake, ownsSocketPlayer } from '../bot/utils/socketAuth.js';

const originalEnv = { BOT_TOKEN: process.env.BOT_TOKEN, API_AUTH_TOKEN: process.env.API_AUTH_TOKEN, AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET };
beforeEach(() => {
  process.env.BOT_TOKEN = 'test-telegram-token';
  process.env.API_AUTH_TOKEN = 'test-service-token';
  process.env.AUTH_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
});
after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

function telegramData(overrides = {}, extra = []) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 123 }),
    ...overrides
  });
  for (const [key, value] of extra) params.append(key, value);
  const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
  const text = [...params.entries()].map(([key, value]) => `${key}=${value}`).sort().join('\n');
  params.set('hash', crypto.createHmac('sha256', secret).update(text).digest('hex'));
  return params.toString();
}

function request(headers, optional = false) {
  const req = { get: (name) => headers[name], auth: { accountId: 'untrusted-preexisting' } };
  const result = { next: false, status: 200 };
  const res = { status: (value) => { result.status = value; return res; }, json: (body) => { result.body = body; } };
  (optional ? optionalAuthenticate : authenticate)(req, res, () => { result.next = true; });
  return { ...result, auth: req.auth };
}

test('client-controlled account and Google headers cannot authenticate', () => {
  for (const headers of [ { 'x-tpc-account-id': 'victim' }, { 'x-google-id': 'victim' }, { 'x-tpc-account-id': 'victim', 'x-google-id': 'victim' } ]) {
    assert.deepEqual(request(headers), { next: false, status: 401, body: { error: 'unauthorized' }, auth: undefined });
  }
});

test('valid Telegram data authenticates only its signed identity', () => {
  assert.deepEqual(request({ 'x-telegram-init-data': telegramData(), 'x-tpc-account-id': 'victim', 'x-google-id': 'victim' }).auth, { telegramId: 123 });
});

test('Telegram authentication rejects expiry, future dates, malformed users and duplicates', () => {
  const now = Math.floor(Date.now() / 1000);
  for (const values of [
    { auth_date: '' }, { auth_date: 'NaN' }, { auth_date: String(now + 120) },
    { auth_date: String(now - TELEGRAM_AUTH_MAX_AGE_SECONDS - 1) },
    { user: '{' }, { user: '{}' }, { user: JSON.stringify({ id: -1 }) },
    { user: JSON.stringify({ id: '123' }) }
  ]) assert.equal(verifyTelegramInitData(telegramData(values)), null);
  assert.equal(verifyTelegramInitData(telegramData({}, [['user', JSON.stringify({ id: 999 })]])), null);
  assert.equal(verifyTelegramInitData(telegramData({}, [['auth_date', String(now)]])), null);
});

test('Telegram signatures must match a configured bot secret', () => {
  const valid = telegramData();
  assert.equal(verifyTelegramInitData(valid, ''), null);
  assert.equal(verifyTelegramInitData(valid, 'other-bot'), null);
  assert.equal(verifyTelegramInitData(valid.replace('hash=', 'hash=00')), null);
  assert.equal(verifyTelegramInitData(valid.replace('123', '456')), null);
});

test('optional authentication never promotes unverified identity claims', () => {
  assert.deepEqual(request({ 'x-tpc-account-id': 'victim' }, true), { next: true, status: 200, auth: undefined });
});

test('trusted service tokens require the Bearer authorization scheme', () => {
  assert.deepEqual(request({ authorization: 'Bearer test-service-token' }).auth, { apiToken: true });
  assert.equal(request({ authorization: 'test-service-token' }).status, 401);
  assert.equal(request({ authorization: 'Bearer test-service-token extra' }).status, 401);
});

test('signed sessions are account-bound and never carry service privilege', () => {
  const token = createAuthSession({ accountId: 'owner', googleId: 'google-owner', apiToken: true });
  assert.deepEqual(verifyAuthSession(token), { accountId: 'owner', googleId: 'google-owner' });
  assert.deepEqual(request({ authorization: `Bearer ${token}`, 'x-tpc-account-id': 'victim' }).auth, { accountId: 'owner', googleId: 'google-owner' });
  const parts = token.split('.');
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  parts[1] = Buffer.from(JSON.stringify({ ...claims, accountId: 'victim' })).toString('base64url');
  assert.equal(verifyAuthSession(parts.join('.')), null);
});

test('sessions expire and secret rotation invalidates old sessions', () => {
  const now = Date.now();
  const token = createAuthSession({ accountId: 'owner' }, now);
  assert.equal(verifyAuthSession(token, now + AUTH_SESSION_TTL_SECONDS * 1000), null);
  assert.equal(verifyAuthSession(token, now - 120000), null);
  process.env.AUTH_SESSION_SECRET = 'another-session-secret-with-at-least-32-characters';
  assert.equal(verifyAuthSession(token), null);
});

test('missing and invalid signing secrets fail closed', () => {
  process.env.AUTH_SESSION_SECRET = 'short';
  assert.throws(() => createAuthSession({ accountId: 'owner' }), /at least 32/);
  assert.equal(verifyAuthSession('tpg1.invalid.invalid'), null);
  delete process.env.AUTH_SESSION_SECRET;
  delete process.env.BOT_TOKEN;
  assert.throws(() => createAuthSession({ accountId: 'owner' }), /at least 32/);
});

test('existing bot and service secrets cannot mint account sessions', () => {
  delete process.env.AUTH_SESSION_SECRET;
  assert.throws(() => createAuthSession({ accountId: 'owner' }), /at least 32/);
  assert.equal(resolveAuthCredentials({ token: process.env.BOT_TOKEN }), null);
});

test('socket handshakes reject raw identity claims before database access', async () => {
  let lookups = 0;
  const result = await authenticateSocketHandshake({ auth: { accountId: 'victim', googleId: 'victim' } }, async () => { lookups++; });
  assert.equal(result, null);
  assert.equal(lookups, 0);
});

test('socket sessions bind to persisted identity and cannot re-register as another player', async () => {
  const token = createAuthSession({ accountId: 'owner', googleId: 'google-owner' });
  const result = await authenticateSocketHandshake({ auth: { token, accountId: 'victim' } }, async (selector) => {
    assert.deepEqual(selector, { accountId: 'owner' });
    return { accountId: 'owner', googleId: 'google-owner', tpcAccountNumber: 'owner' };
  });
  assert.deepEqual(result, { auth: { accountId: 'owner', googleId: 'google-owner' }, playerId: 'owner' });
  const socket = { data: { authenticatedPlayerId: result.playerId } };
  assert.equal(ownsSocketPlayer(socket, 'owner'), true);
  assert.equal(ownsSocketPlayer(socket, 'victim'), false);
  assert.equal(ownsSocketPlayer({ data: {} }, 'owner'), false);
});

test('socket identities reject banned, deleted and relinked accounts', async () => {
  const token = createAuthSession({ accountId: 'owner', googleId: 'google-owner' });
  for (const user of [null, { accountId: 'owner', googleId: 'google-owner', isBanned: true }, { accountId: 'owner', googleId: 'different-google' }, { accountId: 'victim', googleId: 'google-owner' }]) {
    assert.equal(await authenticateSocketHandshake({ auth: { token } }, async () => user), null);
  }
});

test('Telegram sockets derive the account from the verified Telegram user', async () => {
  const result = await authenticateSocketHandshake({ auth: { initData: telegramData(), accountId: 'victim' } }, async (selector) => {
    assert.deepEqual(selector, { telegramId: 123 });
    return { accountId: 'telegram-owner', telegramId: 123 };
  });
  assert.equal(result.playerId, 'telegram-owner');
  assert.deepEqual(result.auth, { telegramId: 123, accountId: 'telegram-owner' });
});
