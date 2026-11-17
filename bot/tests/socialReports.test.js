import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createSocialReportsRouter } from '../routes/socialReports.js';
const requestId = '11111111-1111-4111-8111-111111111111';
function fixture(env = {}) {
  const rows = []; const lookups = []; let queryCount = 0;
  const reports = {
    findOne: query => ({ lean: async () => rows.find(row => row.reporter === query.reporter && row.requestId === query.requestId) }),
    create: async value => { const row = { _id: '111111111111111111111111', ...value, status: 'pending' }; rows.push(row); return row; },
    findOneAndUpdate: (selector, update) => ({ lean: async () => { const row = rows.find(row => row._id === selector._id && row.status === selector.status); if (row) Object.assign(row, update.$set); return row; } }),
    find: query => { queryCount++; assert.deepEqual(query, { status: 'pending' }); return { sort: value => { assert.deepEqual(value, { createdAt: 1, _id: 1 }); return { limit: value => { assert.equal(value, 100); return { lean: async () => rows }; } }; } }; }
  };
  const users = { findOne: query => { lookups.push(query); return { select: value => { assert.equal(value, 'accountId'); return { lean: async () => query.accountId === 'bob' ? { accountId: 'bob' } : null }; } }; } };
  const router = createSocialReportsRouter({ reports, users, env });
  async function request(method = 'post', body = { targetAccountId: 'bob', reason: 'spam', requestId }, user = { accountId: 'alice' }, auth = { socialVerified: true }, params = {}) {
    const req = { body, socialUser: user, auth, params };
    const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    let allowed = false;
    router.stack.find(layer => !layer.route).handle(req, res, () => { allowed = true; });
    if (!allowed) return res;
    const route = router.stack.find(layer => layer.route?.methods[method]);
    // Business handler only; HTTP limiter is covered by the listener test below.
    await route.route.stack.at(-1).handle(req, res);
    return res;
  }
  return { rows, lookups, reports, router, request, queries: () => queryCount };
}
test('verified reporter and canonical peer are used, extra private fields never stored', async () => {
  const f = fixture(); const result = await f.request('post', { targetAccountId: 'bob', reason: 'spam', requestId, reporter: 'victim', text: 'secret', attachment: 'secret' });
  assert.equal(result.statusCode, 202); assert.deepEqual(f.lookups, [{ accountId: 'bob' }]);
  assert.deepEqual(f.rows[0], { _id: '111111111111111111111111', reporter: 'alice', target: 'bob', reason: 'spam', requestId, status: 'pending' });
  assert.deepEqual(result.body, { reportId: '111111111111111111111111', status: 'received' });
});
test('unsigned compatibility identity and banned accounts cannot report or read', async () => {
  for (const method of ['post', 'get']) {
    const f = fixture({ SOCIAL_MODERATOR_ACCOUNT_IDS: 'alice' });
    assert.equal((await f.request(method, {}, { accountId: 'alice' }, { apiToken: true })).statusCode, 401);
    assert.equal((await f.request(method, {}, { accountId: 'alice', isBanned: true })).statusCode, 401);
    assert.equal(f.rows.length, 0); assert.equal(f.queries(), 0);
  }
});
test('invalid input, self and absent targets do not write', async () => {
  const f = fixture();
  for (const patch of [{ targetAccountId: {} }, { targetAccountId: 'alice' }, { reason: {} }, { reason: 'made-up' }, { requestId: 'bad' }]) {
    assert.equal((await f.request('post', { targetAccountId: 'bob', reason: 'spam', requestId, ...patch })).statusCode, 400);
  }
  assert.equal((await f.request('post', { targetAccountId: '22', reason: 'spam', requestId })).statusCode, 404);
  assert.equal(f.rows.length, 0);
});
test('retry is idempotent, conflict is rejected and storage failure never reports success', async () => {
  const f = fixture(); await f.request(); await f.request(); assert.equal(f.rows.length, 1);
  assert.equal((await f.request('post', { targetAccountId: 'bob', reason: 'other', requestId })).statusCode, 409);
  const failing = fixture(); failing.reports.create = async () => { throw new Error('private database details'); };
  assert.equal((await failing.request()).statusCode, 503);
});
test('ordinary users and empty moderator configuration cannot read reports', async () => {
  for (const env of [{}, { SOCIAL_MODERATOR_ACCOUNT_IDS: 'other' }, { DEV_ACCOUNT_ID: 'alice', VITE_DEV_ACCOUNT_ID: 'alice' }]) {
    const f = fixture(env); assert.equal((await f.request('get')).statusCode, 403); assert.equal(f.queries(), 0);
  }
});
test('allowlisted verified moderator receives bounded queue without internal request IDs', async () => {
  const f = fixture({ SOCIAL_MODERATOR_ACCOUNT_IDS: ' alice , moderator' }); await f.request();
  const result = await f.request('get'); assert.equal(result.statusCode, 200); assert.equal(result.body.length, 1);
  assert.equal(result.body[0].target, 'bob'); assert.equal('requestId' in result.body[0], false);
});
test('report write route includes rate limiter before business handler', () => {
  const f = fixture(); const route = f.router.stack.find(layer => layer.route?.methods.post);
  assert.equal(route.route.stack.length, 2);
});

test('concurrent duplicate insert resolves to existing receipt without extra write', async () => {
  const f = fixture();
  f.reports.create = async value => { f.rows.push({ _id: '111111111111111111111111', ...value }); throw Object.assign(new Error('duplicate'), { code: 11000 }); };
  const result = await f.request(); assert.equal(result.statusCode, 202); assert.equal(f.rows.length, 1);
});
test('only moderators may mark pending reports reviewed, without any user punishment', async () => {
  const f = fixture({ SOCIAL_MODERATOR_ACCOUNT_IDS: 'moderator' }); await f.request();
  assert.equal((await f.request('patch')).statusCode, 403);
  const user = { accountId: 'moderator' }, auth = { socialVerified: true };
  assert.equal((await f.request('patch', {}, user, auth, { reportId: 'bad' })).statusCode, 400);
  const result = await f.request('patch', {}, user, auth, { reportId: '111111111111111111111111' });
  assert.equal(result.statusCode, 200); assert.equal(f.rows[0].status, 'reviewed'); assert.ok(f.rows[0].reviewedAt instanceof Date);
  assert.equal((await f.request('patch', {}, user, auth, { reportId: '111111111111111111111111' })).statusCode, 404);
});
test('HTTP limiter rejects request 11 and isolates verified reporters', async () => {
  const f = fixture(); const app = express(); app.use(express.json());
  // Test-only authentication stub supplies a verified identity.
  app.use((req, _res, next) => { req.auth = { socialVerified: true }; req.socialUser = { accountId: req.get('test-user') || 'alice' }; next(); });
  app.use(f.router);
  const server = await new Promise((resolve, reject) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); server.on('error', reject); });
  try {
    const url = `http://127.0.0.1:${server.address().port}/reports`;
    const send = user => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'test-user': user }, body: JSON.stringify({ targetAccountId: 'bob', reason: 'spam', requestId }) });
    for (let i = 0; i < 10; i++) assert.equal((await send('alice')).status, 202);
    assert.equal((await send('alice')).status, 429); assert.equal((await send('carol')).status, 202);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
