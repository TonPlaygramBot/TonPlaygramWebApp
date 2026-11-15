import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { verifySocialCredentials, resolveSocialUser } from '../middleware/socialAuth.js';

const botToken = 'test-only-bot-token';
const now = Date.now();
const stamp = Math.floor(now / 1000);
function telegram(fields = {}) {
  const params = new URLSearchParams({ auth_date: String(stamp), user: JSON.stringify({ id: 123 }), ...fields });
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}
const options = { now, botToken, maxAgeSeconds: 3600 };

test('fresh signed Telegram data resolves verified external identity only', async () => {
  const identity = await verifySocialCredentials({ initData: telegram(), accountId: 'victim', googleId: 'victim' }, options);
  assert.deepEqual(identity, { telegramId: 123, expiresAt: (stamp + 3600) * 1000 });
});
for (const [label, credentials] of [
  ['accountId header alone', { accountId: 'victim' }], ['Google id header alone', { googleId: 'victim' }],
  ['API token alone', { token: 'trusted-service-token' }], ['tampered init data', { initData: telegram().replace('123', '999') }],
  ['expired init data', { initData: telegram({ auth_date: String(stamp - 3601) }) }],
  ['future init data', { initData: telegram({ auth_date: String(stamp + 120) }) }],
  ['duplicate fields', { initData: `${telegram()}&user=${encodeURIComponent(JSON.stringify({ id: 999 }))}` }],
  ['invalid user JSON', { initData: telegram({ user: '{' }) }],
  ['invalid user ID', { initData: telegram({ user: JSON.stringify({ id: '123' }) }) }]
]) test(`rejects ${label}`, async () => { await assert.rejects(verifySocialCredentials(credentials, options), { code: 'reauthentication_required' }); });

test('never authenticates with missing server Telegram secret', async () => {
  await assert.rejects(verifySocialCredentials({ initData: telegram() }, { ...options, botToken: '' }));
});
test('canonical user mapping ignores attacker account id and rejects banned accounts', async () => {
  const verify = async () => ({ telegramId: 123, expiresAt: now + 10000 });
  const user = { accountId: 'real', telegramId: 123, googleId: 'linked' };
  const result = await resolveSocialUser({ accountId: 'victim' }, { verify, findUser: async (query) => { assert.deepEqual(query, { telegramId: 123 }); return user; } });
  assert.equal(result.auth.accountId, 'real');
  assert.equal(result.auth.socialVerified, true);
  await assert.rejects(resolveSocialUser({}, { verify, findUser: async () => ({ ...user, isBanned: true }) }));
});
test('both supplied identities must belong to the same account', async () => {
  await assert.rejects(resolveSocialUser({}, { verify: async () => ({ telegramId: 123, googleId: 'other' }), findUser: async () => ({ accountId: 'real', googleId: 'linked' }) }));
});

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const googleClient = new OAuth2Client();
const makeGoogle = (fields = {}, wrongSignature = false) => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: 'client-id', sub: 'google-person', iat: stamp, exp: stamp + 3600, ...fields })).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const signature = sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');
  return `${signingInput}.${wrongSignature ? 'A'.repeat(signature.length) : signature}`;
};
const googleOptions = {
  ...options, googleAudiences: ['client-id'],
  verifyGoogle: (jwt, audiences) => googleClient.verifySignedJwtWithCertsAsync(jwt, { fixture: publicKey.export({ type: 'spki', format: 'pem' }) }, audiences, ['accounts.google.com', 'https://accounts.google.com'])
};
test('official Google verifier accepts a valid signed token and returns its subject', async () => {
  const result = await verifySocialCredentials({ googleIdToken: makeGoogle() }, googleOptions);
  assert.equal(result.googleId, 'google-person');
});
for (const [label, token] of [
  ['invalid signature', makeGoogle({}, true)], ['wrong audience', makeGoogle({ aud: 'attacker-app' })],
  ['wrong issuer', makeGoogle({ iss: 'https://evil.test' })], ['expired token', makeGoogle({ exp: stamp - 1 })],
  ['future issued-at', makeGoogle({ iat: stamp + 120 })], ['untrusted authorized party', makeGoogle({ azp: 'attacker-app' })]
]) test(`Google rejects ${label}`, async () => { await assert.rejects(verifySocialCredentials({ googleIdToken: token }, googleOptions)); });
test('Google fails closed without configured client ID', async () => {
  await assert.rejects(verifySocialCredentials({ googleIdToken: makeGoogle() }, { ...googleOptions, googleAudiences: [] }));
});
test('linking requires both supplied credentials to verify', async () => {
  await assert.rejects(verifySocialCredentials({ initData: telegram(), googleIdToken: 'invalid' }, googleOptions));
  const result = await verifySocialCredentials({ initData: telegram(), googleIdToken: makeGoogle() }, googleOptions);
  assert.equal(result.telegramId, 123);
  assert.equal(result.googleId, 'google-person');
});
