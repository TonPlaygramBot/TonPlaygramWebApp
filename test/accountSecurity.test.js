import express from 'express';
import crypto from 'node:crypto';
import User from '../bot/models/User.js';
import accountRoutes from '../bot/routes/account.js';
import { createAuthSession, verifyAuthSession } from '../bot/utils/authSession.js';
import { verifyGoogleIdToken } from '../bot/utils/googleAuth.js';
import { fetchTelegramInfo } from '../bot/utils/telegram.js';

jest.mock('../bot/bot.js', () => ({ __esModule: true, default: {} }));
jest.mock('../bot/models/User.js');
jest.mock('../bot/utils/googleAuth.js', () => ({ verifyGoogleIdToken: jest.fn() }));
jest.mock('../bot/utils/telegram.js', () => ({ fetchTelegramInfo: jest.fn() }));
jest.mock('../bot/utils/wallet.js', () => ({ generateWalletAddress: async () => ({ address: 'new-wallet', publicKey: 'public' }) }));
jest.mock('../bot/utils/nftService.js', () => ({ mintGiftNFT: jest.fn() }));
jest.mock('../bot/utils/notifications.js', () => ({}));
jest.mock('../bot/routes/store.js', () => ({ applyStoreItemDelivery: jest.fn() }));
jest.mock('../webapp/src/config/poolRoyaleInventoryConfig.js', () => ({ POOL_ROYALE_STORE_ITEMS: [] }));
jest.mock('../webapp/src/config/snookerRoyalInventoryConfig.js', () => ({ SNOOKER_ROYALE_STORE_ITEMS: [] }));

let server;
let base;
const originalEnv = { ...process.env };
const owner = { accountId: 'owner-account', telegramId: 123, balance: 7, transactions: [{ amount: 100 }], save: jest.fn() };
const guest = { accountId: 'guest-account', balance: 5, transactions: [], save: jest.fn() };

function telegramProof(id) {
  const params = new URLSearchParams({ user: JSON.stringify({ id }), auth_date: String(Math.floor(Date.now() / 1000)) });
  const check = [...params.entries()].map(([key, value]) => `${key}=${value}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json(), headers: res.headers };
}

beforeAll(async () => {
  process.env.AUTH_SESSION_SECRET = 'test-account-session-secret-with-32-characters';
  process.env.BOT_TOKEN = 'test-bot-secret';
  process.env.MONGO_URI = 'mock-database';
  const app = express();
  app.use(express.json());
  app.use(accountRoutes);
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  jest.clearAllMocks();
  User.findOne.mockImplementation(async query => [owner, guest].find(user => Object.entries(query).every(([key, value]) => user[key] === value)) || null);
  User.mockImplementation(data => ({ ...data, balance: 0, save: jest.fn().mockResolvedValue(undefined) }));
});
afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  process.env = originalEnv;
});

test('public account numbers and Google IDs cannot authenticate or recover accounts', async () => {
  expect((await post('/info', { accountId: owner.accountId }, { 'x-tpc-account-id': owner.accountId })).status).toBe(401);
  expect((await post('/create', { accountId: guest.accountId })).status).toBe(401);
  expect((await post('/create', { googleId: 'claimed-id' }, { 'x-google-id': 'claimed-id' })).status).toBe(403);
  expect(User.findOne).not.toHaveBeenCalled();
});

test('verified Telegram cannot access or merge another account, including guests', async () => {
  const headers = { 'x-telegram-init-data': telegramProof(123), 'x-tpc-account-id': guest.accountId };
  expect((await post('/info', { accountId: guest.accountId }, headers)).status).toBe(403);
  expect((await post('/create', { telegramId: 123, accountId: guest.accountId }, headers)).status).toBe(403);
  expect(guest.save).not.toHaveBeenCalled();
});

test('verified login returns a signed session and avoids slow Telegram enrichment for existing users', async () => {
  const result = await post('/create', { telegramId: 123 }, { 'x-telegram-init-data': telegramProof(123) });
  expect(result.status).toBe(200);
  expect(result.body.profile.balance).toBe(7);
  expect(verifyAuthSession(result.body.sessionToken)).toEqual({ accountId: owner.accountId, telegramId: 123 });
  expect(result.headers.get('cache-control')).toBe('no-store');
  expect(fetchTelegramInfo).not.toHaveBeenCalled();
});

test('a new guest receives a generated identity and can restore it only with a signed session', async () => {
  const result = await post('/create', {});
  expect(result.status).toBe(200);
  expect(verifyAuthSession(result.body.sessionToken)).toEqual({ accountId: result.body.accountId });
  expect(User).toHaveBeenCalledTimes(1);
  const restored = await post('/create', { accountId: guest.accountId }, { Authorization: `Bearer ${createAuthSession({ accountId: guest.accountId })}` });
  expect(restored.status).toBe(200);
  expect(restored.body.accountId).toBe(guest.accountId);
});

test('Google login requires backend verification and ignores caller-provided profile data', async () => {
  verifyGoogleIdToken.mockResolvedValueOnce(null);
  expect((await post('/create', { googleCredential: 'invalid', googleId: 'g-1' })).status).toBe(401);
  verifyGoogleIdToken.mockResolvedValueOnce({ googleId: 'g-1', email: 'verified@example.com', firstName: 'Verified', lastName: '', photo: '' });
  const result = await post('/create', { googleCredential: 'valid-proof', googleId: 'g-1', firstName: 'Forged' });
  expect(result.status).toBe(200);
  expect(result.body.firstName).toBe('Verified');
  expect(verifyAuthSession(result.body.sessionToken).googleId).toBe('g-1');
});

test('balance reads never rewrite persisted funds from a larger historical ledger', async () => {
  const headers = { Authorization: `Bearer ${createAuthSession({ accountId: owner.accountId, telegramId: 123 })}` };
  expect((await post('/balance', { accountId: owner.accountId }, headers)).body.balance).toBe(7);
  expect((await post('/info', { accountId: owner.accountId }, headers)).body.balance).toBe(7);
  expect(owner.save).not.toHaveBeenCalled();
});

test.each(['/deposit', '/gift', '/store-purchase', '/convert-gifts'])('unverified financial write %s fails before querying or saving', async path => {
  const result = await post(path, { accountId: owner.accountId, amount: 100000, bundle: { items: [{ price: -999 }] } }, { Authorization: `Bearer ${createAuthSession({ accountId: owner.accountId })}` });
  expect(result.status).toBe(403);
  expect(result.body.error).toBe('verified_settlement_required');
  expect(User.findOne).not.toHaveBeenCalled();
  expect(owner.save).not.toHaveBeenCalled();
});
