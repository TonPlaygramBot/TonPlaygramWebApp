import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createGoogleTokenVerifier } from '../bot/utils/googleAuth.js';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-google-key', use: 'sig', alg: 'RS256' };
const now = 1800000000000;
const validClaims = {
  sub: 'google-user', iss: 'https://accounts.google.com', aud: 'test-client.apps.googleusercontent.com',
  iat: now / 1000 - 60, exp: now / 1000 + 3600,
  email: 'verified@example.test', email_verified: true, given_name: 'Test', family_name: 'User', picture: 'https://example.test/profile.png'
};

function sign(claims = {}, header = {}, key = privateKey) {
  const data = [ { alg: 'RS256', kid: jwk.kid, ...header }, { ...validClaims, ...claims } ]
    .map((value) => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
  return `${data}.${crypto.sign('RSA-SHA256', Buffer.from(data), key).toString('base64url')}`;
}

function fixture(options = {}) {
  const requests = [];
  const verify = createGoogleTokenVerifier({
    now: () => now, audiences: [validClaims.aud],
    fetchImpl: async (url, opts) => {
      requests.push({ url, opts });
      return { ok: true, headers: new Headers({ 'cache-control': 'public, max-age=3600' }), json: async () => ({ keys: [jwk] }) };
    },
    ...options
  });
  return { verify, requests };
}

test('valid Google tokens require RSA signature and yield only verified claims', async () => {
  const { verify, requests } = fixture();
  assert.deepEqual(await verify(sign()), {
    googleId: 'google-user', email: 'verified@example.test', firstName: 'Test', lastName: 'User', photo: 'https://example.test/profile.png'
  });
  assert.equal(requests[0].url, 'https://www.googleapis.com/oauth2/v3/certs');
  assert.equal(requests[0].opts.redirect, 'error');
  assert.ok(requests[0].opts.signal instanceof AbortSignal);
  assert.equal((await verify(sign())).googleId, 'google-user');
  assert.equal(requests.length, 1, 'verification keys are cached');
});

test('Google verification rejects wrong audience, issuer, expiry, future tokens and missing subject', async () => {
  const { verify, requests } = fixture();
  for (const claims of [
    { aud: 'attacker-client' }, { aud: [validClaims.aud] }, { azp: 'attacker-client' },
    { iss: 'https://attacker.test' }, { exp: now / 1000 }, { exp: '1800003600' },
    { iat: now / 1000 + 120 }, { nbf: now / 1000 + 10 }, { sub: '' }, { sub: 123 }
  ]) assert.equal(await verify(sign(claims)), null);
  assert.equal(requests.length, 0, 'invalid claims do not trigger key requests');
});

test('decoded or forged tokens cannot authenticate', async () => {
  const { verify } = fixture();
  assert.equal(await verify(sign({}, { alg: 'none' })), null);
  assert.equal(await verify(sign({}, { alg: 'HS256' })), null);
  assert.equal(await verify(sign({}, {}, otherKeys.privateKey)), null);
  const parts = sign().split('.');
  parts[1] = Buffer.from(JSON.stringify({ ...validClaims, sub: 'victim' })).toString('base64url');
  assert.equal(await verify(parts.join('.')), null);
  assert.equal(await verify('not-a-token'), null);
});

test('unknown signing keys are rejected without repeated key fetches', async () => {
  const { verify, requests } = fixture();
  assert.equal(await verify(sign({}, { kid: 'attacker-key' })), null);
  assert.equal(await verify(sign({}, { kid: 'another-key' })), null);
  assert.equal(requests.length, 1);
});

test('Google verification fails closed without configured audience or available keys', async () => {
  assert.equal(await fixture({ audiences: [] }).verify(sign()), null);
  assert.equal(await fixture({ fetchImpl: async () => { throw new Error('network unavailable'); } }).verify(sign()), null);
  assert.equal(await fixture({ fetchImpl: async () => ({ ok: false }) }).verify(sign()), null);
  assert.equal(await fixture({ fetchImpl: async () => ({ ok: true, headers: new Headers(), json: async () => ({ keys: [] }) }) }).verify(sign()), null);
});

test('unverified email is not accepted as a verified profile address', async () => {
  const result = await fixture().verify(sign({ email_verified: false }));
  assert.equal(result.googleId, 'google-user');
  assert.equal(result.email, '');
});

test('concurrent verification shares the same JWKS request', async () => {
  const { verify, requests } = fixture();
  const results = await Promise.all([verify(sign()), verify(sign())]);
  assert.ok(results.every((result) => result?.googleId === 'google-user'));
  assert.equal(requests.length, 1);
});

test('key-service failures do not cause an outbound request for every invalid token', async () => {
  let requests = 0;
  const { verify } = fixture({ fetchImpl: async () => { requests++; throw new Error('unavailable'); } });
  assert.equal(await verify(sign()), null);
  assert.equal(await verify(sign()), null);
  assert.equal(requests, 1);
});
