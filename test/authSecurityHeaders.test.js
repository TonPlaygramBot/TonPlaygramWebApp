import test from 'node:test';
import assert from 'node:assert/strict';
import authenticate from '../bot/middleware/auth.js';

function makeReq(headers = {}) {
  return {
    headers,
    get(name) {
      return this.headers[name.toLowerCase()];
    }
  };
}

function makeRes() {
  return {
    code: 200,
    payload: null,
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    }
  };
}

test('rejects spoofable identity headers by default in production', () => {
  process.env.NODE_ENV = 'production';
  delete process.env.TRUST_CLIENT_IDENTITY_HEADERS;

  const req = makeReq({ 'x-tpc-account-id': 'acc-1' });
  const res = makeRes();
  let nextCalled = false;

  authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.code, 401);
  assert.deepEqual(res.payload, { error: 'unauthorized' });
});

test('allows identity headers only when explicitly enabled', () => {
  process.env.NODE_ENV = 'production';
  process.env.TRUST_CLIENT_IDENTITY_HEADERS = 'true';

  const req = makeReq({ 'x-tpc-account-id': 'acc-2', 'x-google-id': 'g-2' });
  const res = makeRes();
  let nextCalled = false;

  authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.auth, {
    accountId: 'acc-2',
    googleId: 'g-2'
  });
});
