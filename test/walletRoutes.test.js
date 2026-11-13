import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import walletRouter from '../bot/routes/wallet.js';
import User from '../bot/models/User.js';

process.env.BOT_TOKEN = 'wallet-route-test-token';
process.env.API_AUTH_TOKEN = 'wallet-route-test-service-token';
process.env.WITHDRAW_ENABLED = 'true';

async function withServer(run) {
  const app = express();
  app.use(express.json());
  app.use('/wallet', walletRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/wallet`;
  const post = (path, body = {}, headers = {}) => fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.API_AUTH_TOKEN}`, ...headers },
    body: JSON.stringify(body)
  });
  post.get = (path) => fetch(`${base}${path}`);
  try { await run(post); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('deposits, both withdrawals and wallet reset fail closed without querying balances', async () => {
  const previousMode = process.env.MOBILE_STORE_MODE;
  process.env.MOBILE_STORE_MODE = 'false';
  const original = User.findOne;
  User.findOne = () => { throw new Error('disabled route accessed account'); };
  try {
    await withServer(async (post) => {
      const address = await post.get('/deposit-address');
      assert.equal(address.status, 403);
      assert.equal((await address.json()).error, 'verified_deposit_settlement_required');
      for (const [path, error] of [
        ['/deposit', 'verified_deposit_settlement_required'],
        ['/withdraw', 'withdrawals_unavailable_pending_verified_settlement'],
        ['/claim-external', 'withdrawals_unavailable_pending_verified_settlement'],
        ['/reset', 'wallet_reset_disabled']
      ]) {
        const response = await post(path, { accountId: 'victim', amount: 1000, address: 'fake' });
        assert.equal(response.status, 403);
        assert.equal((await response.json()).error, error);
      }
    });
  } finally {
    User.findOne = original;
    if (previousMode === undefined) delete process.env.MOBILE_STORE_MODE;
    else process.env.MOBILE_STORE_MODE = previousMode;
  }
});

test('mobile store restriction stays enforced for deposit and withdrawal aliases', async () => {
  const previousMode = process.env.MOBILE_STORE_MODE;
  process.env.MOBILE_STORE_MODE = 'true';
  try {
    await withServer(async (post) => {
      for (const path of ['/deposit', '/withdraw', '/claim-external']) {
        const response = await post(path, { accountId: 'account', amount: 1 });
        assert.equal(response.status, 403);
        assert.equal((await response.json()).code, 'mobile_store_free_play');
      }
    });
  } finally {
    if (previousMode === undefined) delete process.env.MOBILE_STORE_MODE;
    else process.env.MOBILE_STORE_MODE = previousMode;
  }
});

test('raw identity headers cannot authorize any wallet mutation', async () => {
  await withServer(async (post) => {
    for (const path of ['/send', '/deposit', '/withdraw', '/claim-external', '/reset']) {
      const response = await post(path, { amount: 10 }, {
        Authorization: '', 'x-google-id': 'victim', 'x-tpc-account-id': 'victim'
      });
      assert.equal(response.status, 401);
    }
  });
});

test('send rejects missing idempotency keys and non-integral values before account lookup', async () => {
  const original = User.findOne;
  User.findOne = () => { throw new Error('invalid request accessed account'); };
  try {
    await withServer(async (post) => {
      for (const body of [
        { amount: 1 },
        { amount: 1.5, operationId: 'route-operation-00001' },
        { amount: -2, operationId: 'route-operation-00001' },
        { amount: 1, operationId: 'route-operation-00001', fromAccountId: { $ne: null } }
      ]) {
        const response = await post('/send', body);
        assert.equal(response.status, 400);
      }
    });
  } finally { User.findOne = original; }
});

test('balance reads do not resurrect a higher historical ledger total', async () => {
  const original = User.findOne;
  User.findOne = async () => ({
    accountId: 'account', balance: 25, transactions: [{ amount: 100 }],
    save() { throw new Error('a balance read must not write'); }
  });
  try {
    await withServer(async (post) => {
      const response = await post('/balance', { accountId: 'account' });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).balance, 25);
    });
  } finally { User.findOne = original; }
});
