import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import User from '../models/User.js';
import { createLuckyDailyRouter } from '../routes/luckyDaily.js';
function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; }, setHeader() {} }; }
function signed() {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 123 }) });
  const secret = createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
  params.set('hash', createHmac('sha256', secret).update([...params.entries()].map(([k,v]) => `${k}=${v}`).sort().join('\n')).digest('hex'));
  return params.toString();
}
async function invoke(router, path, body, headers = {}) {
  const req = { body, get: (name) => headers[name] };
  const res = response(); let next = false;
  await router.stack[0].handle(req, res, () => { next = true; });
  if (next) await router.stack.find((item) => item.route?.path === path).route.stack[0].handle(req, res);
  return res;
}
test('every reward endpoint refuses unsigned account and Google identity hints', async () => {
  let writes = 0;
  const action = async () => { writes++; };
  const router = createLuckyDailyRouter({ claim: action });
  for (const path of ['/claim']) {
    const result = await invoke(router, path, { kind: 'spin', accountId: 'victim', telegramId: 456, amount: 999999 }, { 'x-tpc-account-id': 'victim', 'x-google-id': 'victim' });
    assert.equal(result.statusCode, 401);
  }
  assert.equal(writes, 0);
});
test('signed account exclusively determines target; client amount and outcome are ignored', async () => {
  const old = process.env.BOT_TOKEN; process.env.BOT_TOKEN = 'test-only-spin-token';
  const owner = { _id: 'owner-db-id', accountId: 'owner', telegramId: 123 };
  const query = mock.method(User, 'findOne', (filter) => { assert.deepEqual(filter, { telegramId: 123 }); return { select: () => ({ lean: async () => owner }) }; });
  const calls = [];
  const router = createLuckyDailyRouter({ claim: async (...args) => { calls.push(args); return { amount: 400 }; } });
  try {
    const id = randomUUID();
    const result = await invoke(router, '/claim', { kind: 'spin', requestId: id, accountId: 'victim', telegramId: 456, amount: 1000000, outcome: 999 }, { 'x-telegram-init-data': signed(), 'x-tpc-account-id': 'victim' });
    assert.equal(result.statusCode, 200); assert.equal(result.body.amount, 400);
    assert.deepEqual(calls, [['owner-db-id']]);
  } finally { query.mock.restore(); if (old === undefined) delete process.env.BOT_TOKEN; else process.env.BOT_TOKEN = old; }
});
