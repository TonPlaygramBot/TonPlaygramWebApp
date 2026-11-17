import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

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

const route = (router, path) => router.stack.find((layer) => layer.route?.path === path).route.stack.at(-1).handle;
function request(body, headers = {}) { return { body, get: (key) => headers[key.toLowerCase()], auth: {} }; }
function response() {
  return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, setHeader(key, value) { this.headers[key] = value; } };
}

for (const path of ['/balance', '/info']) {
  test(`${path} returns current concurrent state, never saves stale document`, async () => {
    const old = { _id: '507f1f77bcf86cd799439011', accountId: 'account', telegramId: 42, balance: 50, transactions: [{ amount: 100 }], save() { throw new Error('stale save'); } };
    let reads = 0;
    const read = mock.method(User, 'findOne', async () => old);
    const rawRead = mock.method(User.collection, 'findOne', async () => ++reads === 1 ? old : { ...old, balance: 450, transactions: [{ amount: 100 }, { amount: 400 }] });
    const update = mock.method(User.collection, 'findOneAndUpdate', async () => null);
    try {
      const res = response();
      await route(accounts, path)({ body: { accountId: 'account' }, auth: { telegramId: 42 } }, res);
      assert.equal(res.statusCode, 200); assert.equal(res.body.balance, 450);
    } finally { read.mock.restore(); rawRead.mock.restore(); update.mock.restore(); }
  });
  test(`${path} returns explicit unavailable on failed reconciliation`, async () => {
    const read = mock.method(User, 'findOne', async () => ({ _id: '507f1f77bcf86cd799439011', telegramId: 42, balance: 0, transactions: [{ amount: 100 }] }));
    const rawRead = mock.method(User.collection, 'findOne', async () => ({ _id: '507f1f77bcf86cd799439011', balance: 0, transactions: [{ amount: 100 }] }));
    const update = mock.method(User.collection, 'findOneAndUpdate', async () => { throw new Error('offline'); });
    try {
      const res = response();
      await route(accounts, path)({ body: { accountId: 'account' }, auth: { telegramId: 42 } }, res);
      assert.equal(res.statusCode, 503); assert.equal(res.body.error, 'balance_temporarily_unavailable');
    } finally { read.mock.restore(); rawRead.mock.restore(); update.mock.restore(); }
  });
}
test('profile get performs only its identity save, not a stale balance save', async () => {
  let saves = 0;
  const user = { _id: '507f1f77bcf86cd799439011', accountId: 'account', tpcAccountNumber: 'account', telegramId: 42, firstName: 'A', lastName: 'B', photo: 'x', balance: 50, transactions: [{ amount: 100 }], async save() { saves++; } };
  const read = mock.method(User, 'findOne', async () => user);
  const rawRead = mock.method(User.collection, 'findOne', async () => user);
  const update = mock.method(User.collection, 'findOneAndUpdate', async () => ({ ...user, balance: 100 }));
  try {
    const res = response();
    await route(profiles, '/get')({ body: { accountId: 'account' }, auth: { telegramId: 42 } }, res);
    assert.equal(res.body.balance, 100); assert.equal(saves, 1);
  } finally { read.mock.restore(); rawRead.mock.restore(); update.mock.restore(); }
});

for (const path of ['/balance', '/info']) {
  test(`${path} preserves ownership checks before raw wallet access`, async () => {
    const read = mock.method(User, 'findOne', async () => ({ telegramId: 99 }));
    const raw = mock.method(User.collection, 'findOne', async () => { throw new Error('must not access'); });
    try {
      const res = response();
      await route(accounts, path)({ body: { accountId: 'account' }, auth: { telegramId: 42 } }, res);
      assert.equal(res.statusCode, 403); assert.equal(raw.mock.callCount(), 0);
    } finally { read.mock.restore(); raw.mock.restore(); }
  });
  test(`${path} returns 404 if account disappears before raw snapshot`, async () => {
    const read = mock.method(User, 'findOne', async () => ({ _id: '507f1f77bcf86cd799439011', telegramId: 42 }));
    const raw = mock.method(User.collection, 'findOne', async () => null);
    try {
      const res = response();
      await route(accounts, path)({ body: { accountId: 'account' }, auth: { telegramId: 42 } }, res);
      assert.equal(res.statusCode, 404);
    } finally { read.mock.restore(); raw.mock.restore(); }
  });
}
