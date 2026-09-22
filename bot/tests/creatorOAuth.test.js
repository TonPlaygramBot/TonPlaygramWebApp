import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { OAuth, Connection } from '../creator/models.js';
import { catalog, credentials, available } from '../creator/catalog.js';
import { beginOAuth, finishOAuth } from '../creator/oauth.js';
import { session, unseal, digest } from '../creator/security.js';
import { publishStep } from '../creator/publishers.js';
const savedEnv = { ...process.env };
const envKeys = ['CREATOR_ENCRYPTION_KEY', 'CREATOR_PUBLIC_URL', 'CREATOR_TIKTOK_APPROVED', 'CREATOR_GOOGLE_CLIENT_ID', 'CREATOR_GOOGLE_CLIENT_SECRET', 'CREATOR_META_CLIENT_ID', 'CREATOR_META_CLIENT_SECRET', 'CREATOR_INSTAGRAM_CLIENT_ID', 'CREATOR_INSTAGRAM_CLIENT_SECRET', 'CREATOR_TIKTOK_CLIENT_ID', 'CREATOR_TIKTOK_CLIENT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
let states, connections, cookies, res, calls;
beforeEach(t => {
  process.env.CREATOR_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  process.env.CREATOR_PUBLIC_URL = 'https://studio.example';
  process.env.CREATOR_TIKTOK_APPROVED = 'true';
  for (const name of ['GOOGLE', 'META', 'INSTAGRAM', 'TIKTOK']) { process.env[`CREATOR_${name}_CLIENT_ID`] = `${name}-app`; process.env[`CREATOR_${name}_CLIENT_SECRET`] = 'server-only-secret'; }
  states = []; connections = []; cookies = {}; calls = [];
  res = { cookie(name, value) { cookies[name] = value; } };
  t.mock.method(OAuth, 'create', async value => { states.push(value); return value; });
  t.mock.method(OAuth, 'findOneAndDelete', async filter => {
    const index = states.findIndex(r => r.stateHash === filter.stateHash && r.binding === filter.binding && r.platform === filter.platform && r.expiresAt > filter.expiresAt.$gt);
    return index < 0 ? null : states.splice(index, 1)[0];
  });
  t.mock.method(Connection, 'findOne', () => ({ select: async () => null }));
  t.mock.method(Connection, 'findOneAndUpdate', async (filter, update) => { connections.push({ ...filter, ...update.$set }); });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const u = new URL(url); calls.push({ url: u, options });
    let body;
    if (u.pathname.endsWith('/token') || u.pathname.endsWith('/token/') || u.pathname.endsWith('/access_token')) body = { access_token: 'verified-access', refresh_token: 'verified-refresh', expires_in: 3600 };
    else if (u.hostname === 'openidconnect.googleapis.com') body = { sub: 'google-subject', name: 'Google Creator' };
    else if (u.pathname === '/youtube/v3/channels') body = { items: [{ id: 'channel-one', snippet: { title: 'My Channel' } }] };
    else if (u.hostname === 'graph.facebook.com' && u.pathname.endsWith('/me/accounts')) body = { data: [{ id: 'page-one', name: 'My Page', access_token: 'page-access', tasks: ['CREATE_CONTENT'] }] };
    else if (u.hostname === 'graph.facebook.com' && u.pathname.endsWith('/me')) body = { id: 'fb-person-one', name: 'Facebook Creator' };
    else if (u.hostname === 'graph.instagram.com' && u.pathname.endsWith('/me')) body = { user_id: 'ig-account-one', username: 'My Instagram' };
    else if (u.hostname === 'open.tiktokapis.com' && u.pathname === '/v2/user/info/') body = { data: { user: { open_id: 'tt-account-one', display_name: 'My TikTok' } } };
    else throw new Error('Unexpected provider URL');
    return new Response(JSON.stringify(body), { status: 200 });
  });
});
afterEach(() => { for (const key of envKeys) { if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key]; } });
const hosts = { youtube: 'accounts.google.com', facebook: 'www.facebook.com', instagram: 'www.instagram.com', tiktok: 'www.tiktok.com' };
async function start(platform, owner) {
  const url = new URL(await beginOAuth({ creator: owner ? { owner } : undefined }, res, platform));
  return { url, req: { query: { state: url.searchParams.get('state'), code: 'official-authorization-code' }, headers: { cookie: `tpg_creator_oauth=${cookies.tpg_creator_oauth}` }, creator: owner ? { owner } : undefined } };
}
test('only the requested four platforms are offered and removed platforms cannot authorize or publish', async () => {
  assert.deepEqual(catalog().map(p => p.id), Object.keys(hosts));
  for (const platform of ['x', 'threads', 'twitch', 'constructor', '__proto__']) {
    assert.equal(available(platform), false);
    await assert.rejects(() => beginOAuth({}, res, platform));
    await assert.rejects(() => finishOAuth({ query: {}, headers: {} }, res, platform));
    await assert.rejects(() => publishStep({}, { externalId: 'old-upload' }, { platform }, null), { status: 400 });
  }
  assert.equal(states.length, 0); assert.equal(calls.length, 0);
});
for (const [platform, host] of Object.entries(hosts)) test(`${platform}: one official approval signs in a guest and saves encrypted account access`, async () => {
  const { url, req } = await start(platform);
  assert.equal(url.hostname, host); assert.equal(url.protocol, 'https:');
  assert.equal(url.searchParams.get('redirect_uri'), `https://studio.example/api/creator/oauth/${platform}/callback`);
  assert.equal(url.searchParams.get('response_type'), 'code'); assert.ok(url.searchParams.get('state'));
  assert.ok(!url.toString().includes('server-only-secret'));
  if (platform === 'youtube') { assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); assert.ok(url.searchParams.get('scope').includes('openid')); }
  await finishOAuth(req, res, platform);
  const user = session({ headers: { cookie: `tpg_creator=${cookies.tpg_creator}` } });
  const expected = platform === 'youtube' ? 'google:google-subject' : `${platform}:${digest(platform === 'facebook' ? 'fb-person-one' : platform === 'instagram' ? 'ig-account-one' : 'tt-account-one')}`;
  assert.equal(user.owner, expected); assert.equal(connections.length, 1); assert.equal(connections[0].owner, expected);
  assert.equal(unseal(connections[0].credentials, expected).access_token, platform === 'facebook' ? 'page-access' : 'verified-access');
  await assert.rejects(() => finishOAuth(req, res, platform));
  assert.equal(connections.length, 1);
});
test('linking another platform keeps the current Studio owner and never switches their sign-in session', async () => {
  const { req } = await start('instagram', 'google:existing-owner');
  await finishOAuth(req, res, 'instagram');
  assert.equal(connections[0].owner, 'google:existing-owner'); assert.equal(cookies.tpg_creator, undefined);
});
test('wrong browser, changed session, expired state and cancellation cannot create an account', async () => {
  let flow = await start('facebook');
  await assert.rejects(() => finishOAuth({ ...flow.req, headers: { cookie: 'tpg_creator_oauth=wrong-browser' } }, res, 'facebook'));
  assert.equal(states.length, 1);
  await assert.rejects(() => finishOAuth({ ...flow.req, creator: { owner: 'google:another-owner' } }, res, 'facebook'), { status: 401 });
  flow = await start('facebook', 'google:original-owner');
  await assert.rejects(() => finishOAuth({ ...flow.req, creator: undefined }, res, 'facebook'), { status: 401 });
  flow = await start('tiktok'); states[0].expiresAt = new Date(Date.now() - 1000);
  await assert.rejects(() => finishOAuth(flow.req, res, 'tiktok'));
  states.length = 0;
  flow = await start('youtube'); flow.req.query.error = 'access_denied';
  await assert.rejects(() => finishOAuth(flow.req, res, 'youtube'));
  assert.equal(states.length, 0); assert.equal(connections.length, 0); assert.equal(calls.length, 0); assert.equal(cookies.tpg_creator, undefined);
});
test('shared app credentials can be reused, but partial dedicated credentials are never mixed', () => {
  delete process.env.CREATOR_GOOGLE_CLIENT_ID; delete process.env.CREATOR_GOOGLE_CLIENT_SECRET;
  process.env.GOOGLE_CLIENT_ID = 'existing-app'; process.env.GOOGLE_CLIENT_SECRET = 'existing-secret';
  assert.deepEqual(credentials('youtube'), { id: 'existing-app', secret: 'existing-secret' });
  process.env.CREATOR_GOOGLE_CLIENT_ID = 'other-app';
  assert.equal(credentials('youtube').secret, undefined); assert.equal(available('youtube'), false);
  assert.ok(!JSON.stringify(catalog()).includes('existing-secret'));
  process.env.CREATOR_TIKTOK_APPROVED = 'false'; assert.equal(available('tiktok'), false);
});
test('a provider response without an eligible account cannot create a signed session', async t => {
  const { req } = await start('instagram');
  t.mock.method(globalThis, 'fetch', async url => new Response(JSON.stringify(String(url).includes('/me?') ? {} : { access_token: 'verified-access' })));
  await assert.rejects(() => finishOAuth(req, res, 'instagram'));
  assert.equal(connections.length, 0); assert.equal(cookies.tpg_creator, undefined);
});
