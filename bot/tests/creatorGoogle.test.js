import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { OAuth } from '../creator/models.js';
import { beginGoogleSignIn, finishGoogleSignIn, googleClientId, googleSignInStatus, verifyGoogleCredential } from '../creator/googleSignIn.js';
import { session } from '../creator/security.js';

const clientId = '123456789-example.apps.googleusercontent.com';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const savedEnv = { ...process.env };
let records, cookies, res, signIn;
beforeEach(t => {
  process.env.CREATOR_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  process.env.CREATOR_PUBLIC_URL = 'https://studio.example';
  delete process.env.CREATOR_GOOGLE_CLIENT_ID; delete process.env.CREATOR_GOOGLE_CLIENT_SECRET; delete process.env.GOOGLE_CLIENT_ID;
  process.env.VITE_GOOGLE_CLIENT_ID = clientId;
  records = []; cookies = {};
  res = { cookie(name, value) { cookies[name] = value; } };
  t.mock.method(OAuth2Client.prototype, 'getFederatedSignonCertsAsync', async () => ({ certs: { test: publicKey.export({ type: 'spki', format: 'pem' }) }, format: 'PEM' }));
  t.mock.method(OAuth, 'create', async value => { records.push(value); return value; });
  t.mock.method(OAuth, 'findOneAndDelete', async filter => {
    const index = records.findIndex(r => r.stateHash === filter.stateHash && r.binding === filter.binding && r.platform === filter.platform && r.expiresAt > filter.expiresAt.$gt);
    return index < 0 ? null : records.splice(index, 1)[0];
  });
});
afterEach(() => {
  for (const key of ['CREATOR_ENCRYPTION_KEY', 'CREATOR_PUBLIC_URL', 'CREATOR_GOOGLE_CLIENT_ID', 'CREATOR_GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID']) {
    if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
  }
});
function token(overrides = {}, signingKey = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: clientId, iat: now, exp: now + 600, sub: '123456789', name: 'Test Creator', nonce: signIn.nonce, ...overrides })).toString('base64url');
  const signed = `${header}.${body}`;
  return `${signed}.${crypto.sign('RSA-SHA256', Buffer.from(signed), signingKey).toString('base64url')}`;
}
async function start() { signIn = await beginGoogleSignIn({}, res); return `tpg_creator_google=${cookies.tpg_creator_google}`; }
test('existing public Google client ID enables identity login without a client secret', () => {
  assert.equal(googleClientId(), clientId); assert.equal(googleSignInStatus().available, true);
  process.env.CREATOR_GOOGLE_CLIENT_ID = '987654321-dedicated.apps.googleusercontent.com';
  assert.equal(googleClientId(), process.env.CREATOR_GOOGLE_CLIENT_ID);
  process.env.CREATOR_GOOGLE_CLIENT_ID = 'not-a-client-id'; assert.equal(googleSignInStatus().available, false);
});
test('verified Google credentials establish a signed session and cannot be replayed', async () => {
  const cookie = await start(), credential = token();
  const user = await finishGoogleSignIn({ headers: { cookie }, body: { credential } }, res);
  assert.equal(user.signedIn, true);
  assert.equal(session({ headers: { cookie: `tpg_creator=${cookies.tpg_creator}` } }).owner, 'google:123456789');
  await assert.rejects(() => finishGoogleSignIn({ headers: { cookie }, body: { credential } }, res), { status: 401 });
});
test('signature, audience, issuer, expiry and nonce are all required', async () => {
  await start();
  for (const claims of [{ aud: 'attacker-client' }, { iss: 'https://attacker.example' }, { exp: Math.floor(Date.now()/1000) - 1 }, { nonce: '' }, { sub: '' }]) {
    await assert.rejects(() => verifyGoogleCredential(token(claims)), { status: 401 });
  }
  const attacker = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  await assert.rejects(() => verifyGoogleCredential(token({}, attacker.privateKey)), { status: 401 });
});
test('browser binding, nonce ownership and expiry prevent forged or cross-browser sign-ins', async () => {
  const cookie = await start(), credential = token();
  await assert.rejects(() => finishGoogleSignIn({ headers: { cookie: 'tpg_creator_google=another-browser' }, body: { credential } }, res), { status: 401 });
  await assert.rejects(() => finishGoogleSignIn({ headers: { cookie }, body: { credential: token({ nonce: crypto.randomBytes(32).toString('base64url') }) } }, res), { status: 401 });
  assert.equal(records.length, 1);
  records[0].expiresAt = new Date(Date.now() - 1);
  await assert.rejects(() => finishGoogleSignIn({ headers: { cookie }, body: { credential } }, res), { status: 401 });
  await assert.rejects(() => finishGoogleSignIn({ headers: {}, body: { googleId: '123456789' } }, res), { status: 401 });
});
