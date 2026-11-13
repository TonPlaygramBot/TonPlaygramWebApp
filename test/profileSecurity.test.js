import crypto from 'node:crypto';
import express from 'express';
import profileRouter from '../bot/routes/profile.js';
import User from '../bot/models/User.js';
import { verifyGoogleIdToken } from '../bot/utils/googleAuth.js';

jest.mock('../bot/models/User.js', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn()
  }
}));
jest.mock('../bot/utils/googleAuth.js', () => ({ verifyGoogleIdToken: jest.fn() }));
jest.mock('../bot/utils/telegram.js', () => ({ fetchTelegramInfo: jest.fn() }));

const envBefore = { BOT_TOKEN: process.env.BOT_TOKEN, API_AUTH_TOKEN: process.env.API_AUTH_TOKEN };
const botToken = 'profile-security-bot-token';
const serverToken = 'profile-security-server-token';
let server;
let baseUrl;

function telegramHeaders(id) {
  const data = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id })
  });
  const check = [...data].map(([key, value]) => `${key}=${value}`).sort().join('\n');
  const key = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  data.set('hash', crypto.createHmac('sha256', key).update(check).digest('hex'));
  return { 'X-Telegram-Init-Data': data.toString() };
}

async function post(path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

beforeAll(async () => {
  process.env.BOT_TOKEN = botToken;
  process.env.API_AUTH_TOKEN = serverToken;
  const app = express();
  app.use(express.json());
  app.use(profileRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  for (const [key, value] of Object.entries(envBefore)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => jest.resetAllMocks());

const account = () => ({
  _id: 'user-42', accountId: 'account-42', telegramId: 42,
  firstName: 'Owner', balance: 10,
  transactions: [{ amount: 1000, type: 'legacy-credit' }],
  walletAddress: 'wallet-private', walletPublicKey: 'public-key',
  save: jest.fn()
});

test.each(['/register-google', '/register-wallet'])(
  '%s rejects identifier-only account registration without querying users', async (path) => {
    const response = await post(path, { googleId: 'victim', walletAddress: 'known-address' });
    expect(response.status).toBe(410);
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    expect(User.findOne).not.toHaveBeenCalled();
  }
);

test.each(['/updateBalance', '/addTransaction'])(
  '%s denies both account owners and server callers without ledger writes', async (path) => {
    for (const headers of [telegramHeaders(42), { Authorization: `Bearer ${serverToken}` }]) {
      const response = await post(path, {
        telegramId: 42, accountId: 'account-42', balance: 999999,
        amount: 999999, type: 'deposit'
      }, headers);
      expect(response).toEqual({ status: 403, body: { error: 'server_settlement_required' } });
    }
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    expect(User.findOne).not.toHaveBeenCalled();
  }
);

test('forged account headers cannot append ledger entries', async () => {
  const response = await post('/addTransaction', {
    accountId: 'account-42', amount: 999999, type: 'deposit'
  }, { 'X-Tpc-Account-Id': 'account-42', 'X-Google-Id': 'victim' });
  expect(response.status).toBe(401);
  expect(User.findOne).not.toHaveBeenCalled();
});

test('public profile reads expose only public fields and never repair balances', async () => {
  const user = account();
  User.findOne.mockResolvedValue(user);
  const response = await post('/get', { accountId: user.accountId }, {
    'X-Tpc-Account-Id': user.accountId
  });
  expect(response.status).toBe(200);
  expect(response.body.firstName).toBe('Owner');
  for (const privateField of ['balance', 'transactions', 'walletAddress', 'walletPublicKey']) {
    expect(response.body).not.toHaveProperty(privateField);
  }
  expect(user.balance).toBe(10);
  expect(user.save).not.toHaveBeenCalled();
  expect(User.findOneAndUpdate).not.toHaveBeenCalled();
});

test('verified owner sees persisted balance without increasing it from legacy ledger', async () => {
  const user = account();
  User.findOne.mockResolvedValue(user);
  const response = await post('/get', { accountId: user.accountId }, telegramHeaders(42));
  expect(response.status).toBe(200);
  expect(response.body.balance).toBe(10);
  expect(response.body.transactions).toEqual(user.transactions);
  expect(user.save).not.toHaveBeenCalled();
});

test('public read of unknown account never creates an account', async () => {
  User.findOne.mockResolvedValue(null);
  expect((await post('/get', { accountId: 'unknown' })).status).toBe(404);
  expect(User.findOneAndUpdate).not.toHaveBeenCalled();
});

test('Telegram owner cannot link Google by supplying only a public Google ID', async () => {
  const response = await post('/link-google', { telegramId: 42, googleId: 'victim' }, telegramHeaders(42));
  expect(response.status).toBe(400);
  expect(verifyGoogleIdToken).not.toHaveBeenCalled();
  expect(User.findOneAndUpdate).not.toHaveBeenCalled();
});

test('invalid Google credentials cannot link identities', async () => {
  verifyGoogleIdToken.mockResolvedValue(null);
  const response = await post('/link-google', { telegramId: 42, googleCredential: 'invalid' }, telegramHeaders(42));
  expect(response.status).toBe(401);
  expect(User.findOne).not.toHaveBeenCalled();
  expect(User.findOneAndUpdate).not.toHaveBeenCalled();
});

const googleIdentity = {
  googleId: 'google-verified', email: 'owner@example.com',
  firstName: 'Verified', lastName: 'Owner', photo: 'verified-photo'
};

test('Google identity already belonging to another account cannot be reassigned', async () => {
  verifyGoogleIdToken.mockResolvedValue(googleIdentity);
  User.findOne.mockResolvedValueOnce(account()).mockResolvedValueOnce({ _id: 'different-user' });
  const response = await post('/link-google', {
    telegramId: 42, googleCredential: 'valid'
  }, telegramHeaders(42));
  expect(response.status).toBe(409);
  expect(User.findOneAndUpdate).not.toHaveBeenCalled();
});

test('linking uses verified Google fields and preserves a custom photo', async () => {
  const user = { ...account(), photoCustom: true, photo: 'custom' };
  verifyGoogleIdToken.mockResolvedValue(googleIdentity);
  User.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
  User.findOneAndUpdate.mockResolvedValue({ ...user, googleId: googleIdentity.googleId });
  const response = await post('/link-google', {
    telegramId: 42, googleCredential: 'valid', googleId: 'attacker-claimed-id',
    email: 'attacker@example.com', firstName: 'Fake', photo: 'injected'
  }, telegramHeaders(42));
  expect(response.status).toBe(200);
  expect(User.findOneAndUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ _id: user._id, $or: expect.any(Array) }),
    { $set: {
      googleId: googleIdentity.googleId, googleEmail: googleIdentity.email,
      firstName: googleIdentity.firstName, lastName: googleIdentity.lastName
    } },
    { new: true, runValidators: true }
  );
});

test('unique-index race during Google linking returns conflict', async () => {
  verifyGoogleIdToken.mockResolvedValue(googleIdentity);
  User.findOne.mockResolvedValueOnce(account()).mockResolvedValueOnce(null);
  User.findOneAndUpdate.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
  const response = await post('/link-google', { telegramId: 42, googleCredential: 'valid' }, telegramHeaders(42));
  expect(response.status).toBe(409);
});
