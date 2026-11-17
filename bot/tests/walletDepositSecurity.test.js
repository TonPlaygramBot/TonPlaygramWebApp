import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

// node --experimental-test-module-mocks --test bot/tests/walletDepositSecurity.test.js
const unexpected = () => { throw new Error('Deposit must not access persistence or send value'); };
mock.module('../models/User.js', { defaultExport: new Proxy({}, { get: unexpected }) });
mock.module('../models/Message.js', { defaultExport: {} });
mock.module('../bot.js', { defaultExport: {} });
mock.module('../utils/notifications.js', { namedExports: {
  sendTransferNotification: unexpected, sendTPCNotification: unexpected,
  sendDepositNotification: unexpected, sendGiftNotification: unexpected, sendStorePurchaseNotification: unexpected
} });
mock.module('../utils/tonClaim.js', { defaultExport: unexpected });
const { default: router } = await import('../routes/wallet.js');
const { rejectUnverifiedDeposit, rejectUnverifiedReward, rejectUnverifiedWithdrawal } = await import('../utils/depositPolicy.js');
const { default: authenticate } = await import('../middleware/auth.js');
const { blockExternalValueInMobileStore } = await import('../config/mobileStorePolicy.js');
const handlers = (path) => router.stack.find((layer) => layer.route?.path === path).route.stack.map((layer) => layer.handle);
function response() {
  return { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('deposit keeps authentication and mobile-store policy before the closed handler', () => {
  assert.deepEqual(handlers('/deposit'), [authenticate, blockExternalValueInMobileStore, rejectUnverifiedDeposit]);
  assert.deepEqual(handlers('/deposit-address'), [blockExternalValueInMobileStore, rejectUnverifiedDeposit]);
});

test('all claimed amounts and forged proofs fail closed without touching accounts or sending notifications', async () => {
  for (const amount of [1, 1e15, -1, 0, '100', null, Infinity, NaN]) {
    const body = { accountId: 'existing-or-unknown', telegramId: 123, amount,
      transactionHash: 'forged-proof', network: 'mainnet', verified: true };
    const req = { body, auth: { apiToken: true, accountId: body.accountId } };
    for (let replay = 0; replay < 2; replay++) {
      const res = response();
      await handlers('/deposit').at(-1)(req, res);
      assert.equal(res.statusCode, 503);
      assert.equal(res.body.code, 'deposit_verification_unavailable');
      assert.equal(res.headers['Cache-Control'], 'no-store');
      assert.equal(res.body.balance, undefined);
      assert.equal(res.body.transaction, undefined);
    }
  }
});

test('configured address and enable flags do not advertise a destination or reopen credit', async () => {
  const original = { ...process.env };
  try {
    process.env.DEPOSIT_WALLET_ADDRESS = 'must-not-be-advertised';
    process.env.DEPOSIT_ENABLED = 'true';
    process.env.WITHDRAW_ENABLED = 'true';
    for (const path of ['/deposit', '/deposit-address']) {
      const res = response();
      await handlers(path).at(-1)({}, res);
      assert.equal(res.statusCode, 503);
      assert.equal(res.body.address, undefined);
      assert.equal(res.body.code, 'deposit_verification_unavailable');
    }
  } finally {
    for (const key of ['DEPOSIT_WALLET_ADDRESS', 'DEPOSIT_ENABLED', 'WITHDRAW_ENABLED']) {
      if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
    }
  }
});

test('unauthenticated deposit is rejected before handler and mobile-store stays blocked', () => {
  const unauth = response();
  authenticate({ get: () => undefined }, unauth, unexpected);
  assert.equal(unauth.statusCode, 401);
  const original = process.env.MOBILE_STORE_MODE;
  try {
    process.env.MOBILE_STORE_MODE = 'true';
    const mobile = response();
    blockExternalValueInMobileStore({}, mobile, unexpected);
    assert.equal(mobile.statusCode, 403);
    assert.equal(mobile.body.code, 'mobile_store_free_play');
  } finally {
    if (original === undefined) delete process.env.MOBILE_STORE_MODE; else process.env.MOBILE_STORE_MODE = original;
  }
});

const { default: accounts } = await import('../routes/account.js');
test('client rewards and BOTH withdrawal routes cannot mutate or transmit even with enable flags', async () => {
  const accountHandlers = accounts.stack.find((layer) => layer.route?.path === '/deposit').route.stack.map((layer) => layer.handle);
  assert.deepEqual(accountHandlers, [authenticate, rejectUnverifiedReward]);
  for (const path of ['/withdraw', '/claim-external']) {
    assert.equal(handlers(path)[2], rejectUnverifiedWithdrawal);
  }
  const original = process.env.WITHDRAW_ENABLED;
  try {
    process.env.WITHDRAW_ENABLED = 'true';
    for (const [handler, code] of [[accountHandlers[1], 'reward_verification_unavailable'],
      [handlers('/withdraw')[2], 'withdrawal_verification_unavailable'],
      [handlers('/claim-external')[2], 'withdrawal_verification_unavailable']]) {
      const res = response();
      await handler({ body: { accountId: 'any', telegramId: 123, amount: 1000000, address: 'any', game: 'snake-win' }, auth: { apiToken: true } }, res, unexpected);
      assert.equal(res.statusCode, 503);
      assert.equal(res.body.code, code);
      assert.equal(res.headers['Cache-Control'], 'no-store');
    }
  } finally {
    if (original === undefined) delete process.env.WITHDRAW_ENABLED; else process.env.WITHDRAW_ENABLED = original;
  }
});
