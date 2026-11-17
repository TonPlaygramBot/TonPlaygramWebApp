import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import authenticate, { verifyTelegramInitData, optionalAuthenticate } from '../middleware/auth.js';

const token = '123:test-secret';
const now = 1800000000000;
function signed(fields = {}, key = token) {
  const p = new URLSearchParams({ auth_date: String(now / 1000), user: JSON.stringify({ id: 123 }), ...fields });
  const secret = createHmac('sha256', 'WebAppData').update(key).digest();
  p.set('hash', createHmac('sha256', secret).update([...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n')).digest('hex'));
  return p.toString();
}
const verify = (data, key = token) => verifyTelegramInitData(data, key, { now });

test('valid signed payload preserves the legacy return shape', () => {
  const data = verify(signed({ query_id: 'test-query' }));
  assert.equal(JSON.parse(data.user).id, 123);
  assert.equal(data.query_id, 'test-query');
  assert.equal(data.hash, undefined);
});
test('missing bot token cannot authenticate a payload signed with an empty key', () => {
  assert.equal(verify(signed({}, ''), ''), null);
});
test('tampered, malformed and duplicate fields are rejected', () => {
  for (const value of [null, {}, '', 'x'.repeat(16385), signed().replace('123', '456'), signed() + '&hash=bad', signed() + '&user=%7B%22id%22%3A456%7D', signed().replace(/hash=[^&]+/, 'hash=xyz')]) {
    assert.equal(verify(value), null);
  }
});
test('expired, missing and future timestamps are rejected at the boundaries', () => {
  for (const auth_date of ['', 'NaN', '-1', String(now / 1000 - 86400), String(now / 1000 + 61)]) {
    assert.equal(verify(signed({ auth_date })), null);
  }
  assert.ok(verify(signed({ auth_date: String(now / 1000 - 86399) })));
  assert.ok(verify(signed({ auth_date: String(now / 1000 + 60) })));
});
test('signed malformed users and unsafe identifiers are rejected without throwing', () => {
  for (const user of ['bad-json', 'null', '{}', '{"id":"123"}', '{"id":-1}', '{"id":0}', '{"id":9007199254740992}']) {
    assert.equal(verify(signed({ user })), null);
  }
});
test('invalid signed credentials cannot fall back to compatibility identity headers', () => {
  const req = { get: (name) => ({ 'x-telegram-init-data': 'invalid', 'x-tpc-account-id': 'victim', 'x-google-id': 'victim' })[name] };
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  let calls = 0;
  authenticate(req, res, () => calls++);
  assert.equal(calls, 0);
  assert.equal(res.code, 401);
  optionalAuthenticate(req, res, () => calls++);
  assert.equal(calls, 1);
  assert.equal(req.auth, undefined);
});
test('trusted API token without Telegram payload still works', () => {
  const previous = process.env.API_AUTH_TOKEN;
  process.env.API_AUTH_TOKEN = 'server-test-key';
  try {
    for (const initData of [undefined, 'expired-or-invalid']) {
      const req = { get: (name) => ({ authorization: 'Bearer server-test-key', 'x-telegram-init-data': initData })[name] };
      let called = false;
      authenticate(req, {}, () => { called = true; });
      assert.equal(called, true);
      assert.deepEqual(req.auth, { apiToken: true });
    }
  } finally {
    if (previous === undefined) delete process.env.API_AUTH_TOKEN;
    else process.env.API_AUTH_TOKEN = previous;
  }
});
