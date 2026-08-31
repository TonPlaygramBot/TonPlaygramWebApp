import assert from 'node:assert/strict';
import test from 'node:test';
import { completeAuthorization, createAuthorization, encryptCredentials } from '../services/socialOAuth.js';

const env = {
  SOCIAL_OAUTH_STATE_SECRET: 'state-secret-for-tests',
  SOCIAL_CREDENTIALS_ENCRYPTION_KEY: 'credentials-secret-for-tests',
  SOCIAL_X_CLIENT_ID: 'x-client',
  SOCIAL_X_CLIENT_SECRET: 'x-secret',
  SOCIAL_X_REDIRECT_URI: 'https://example.test/api/admin/social/accounts/x/callback'
};

test('creates an official X OAuth authorization URL with state and PKCE', () => {
  const { authorizationUrl } = createAuthorization('x', 'owner-1', env);
  const url = new URL(authorizationUrl);
  assert.equal(url.origin, 'https://twitter.com');
  assert.equal(url.searchParams.get('client_id'), 'x-client');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(url.searchParams.get('state'));
});

test('exchanges a one-time authorization state and loads the provider identity', async () => {
  const { authorizationUrl } = createAuthorization('x', 'owner-2', env);
  const state = new URL(authorizationUrl).searchParams.get('state');
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    if (requests.length === 1) return { ok: true, json: async () => ({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 }) };
    return { ok: true, json: async () => ({ data: { id: '42', username: 'tonplaygram' } }) };
  };
  const result = await completeAuthorization('x', { state, code: 'code' }, env, fetchImpl);
  assert.equal(result.ownerId, 'owner-2');
  assert.equal(result.accountName, 'tonplaygram');
  assert.match(String(requests[0].options.body), /code_verifier=/);
});

test('encrypts credentials without storing the token in plaintext', () => {
  const encrypted = encryptCredentials({ access_token: 'very-secret' }, env);
  assert.equal(encrypted.split('.').length, 3);
  assert.equal(encrypted.includes('very-secret'), false);
});
