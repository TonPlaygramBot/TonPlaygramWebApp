import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import router from '../creator/routes.js';
import { Connection, OAuth, Post, Media } from '../creator/models.js';
import { configured, seal, unseal, issueSession, session, sign } from '../creator/security.js';
import { beginOAuth, finishOAuth } from '../creator/oauth.js';
import { validateContent } from '../creator/publishers.js';
import { runDelivery, tickQueue, summarize } from '../creator/queue.js';
import { verifyMediaLink } from '../creator/media.js';
import { validIngest, encoderArgs } from '../creator/live.js';
const originalFetch = globalThis.fetch;
let mongo, server, origin;
const owner = 'google:creator_one', other = 'google:creator_two';
function cookieFor(identity = owner) { let cookie; issueSession({ cookie(name, value) { cookie = `${name}=${value}`; } }, identity, 'Test Creator'); return cookie; }
async function call(path, options = {}) {
  const response = await originalFetch(`${origin}/api/creator${path}`, { ...options, headers: { cookie: cookieFor(), origin: process.env.CREATOR_PUBLIC_URL, 'x-creator-request': '1', 'content-type': 'application/json', ...options.headers }, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  return { status: response.status, data: await response.json() };
}
before(async () => {
  process.env.CREATOR_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  process.env.CREATOR_PUBLIC_URL = 'http://localhost:3000';
  process.env.CREATOR_META_CLIENT_ID = 'test-id'; process.env.CREATOR_META_CLIENT_SECRET = 'test-secret';
  process.env.CREATOR_GOOGLE_CLIENT_ID = 'google-id'; process.env.CREATOR_GOOGLE_CLIENT_SECRET = 'google-secret';
  if (!process.env.CREATOR_TEST_MONGO_URI) mongo = await MongoMemoryServer.create();
  await mongoose.connect(process.env.CREATOR_TEST_MONGO_URI || mongo.getUri());
  if (process.env.CREATOR_TEST_MONGO_URI && mongoose.connection.name !== 'creator_studio_ci') throw new Error('Integration tests require the dedicated creator_studio_ci database.');
  await mongoose.connection.dropDatabase();
  await Promise.all([Connection.init(), OAuth.init(), Post.init(), Media.init()]);
  const app = express(); app.use(express.json()); app.use('/api/creator', router);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { globalThis.fetch = originalFetch; if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo?.stop(); });
test('optional configuration cannot break app startup', () => {
  const saved = process.env.CREATOR_ENCRYPTION_KEY; delete process.env.CREATOR_ENCRYPTION_KEY;
  assert.equal(configured(), false); process.env.CREATOR_ENCRYPTION_KEY = saved; assert.equal(configured(), true);
});
test('credentials are encrypted and bound to the owner', () => {
  const encrypted = seal({ access_token: 'secret-test-token' }, owner);
  assert.ok(!encrypted.includes('secret-test-token')); assert.equal(unseal(encrypted, owner).access_token, 'secret-test-token');
  assert.throws(() => unseal(encrypted, other)); assert.throws(() => unseal(encrypted.slice(0, -3), owner));
});
test('studio ignores spoofed legacy account and Google headers', async () => {
  const r = await call('/accounts', { headers: { cookie: '', 'x-google-id': 'creator_one', 'x-tpc-account-id': 'owner' } }); assert.equal(r.status, 401);
  assert.equal(session({ headers: { cookie: cookieFor() + 'tampered' } }), null);
});
test('cross-origin mutations fail CSRF checks', async () => {
  assert.equal((await call('/posts', { method: 'POST', headers: { origin: 'https://attacker.example' }, body: {} })).status, 403);
  assert.equal((await call('/posts', { method: 'POST', headers: { 'x-creator-request': '' }, body: {} })).status, 403);
});
test('expired and forged Telegram init data cannot start a session', async () => {
  process.env.BOT_TOKEN = 'test-only-token';
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now()/1000) - 7200), user: JSON.stringify({ id: 123, first_name: 'Test' }) });
  const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secret).update([...params].map(([k,v]) => `${k}=${v}`).sort().join('\n')).digest('hex'); params.set('hash', hash);
  assert.equal((await call('/session/telegram', { method: 'POST', body: { initData: params.toString() } })).status, 401);
  params.set('auth_date', String(Math.floor(Date.now()/1000))); assert.equal((await call('/session/telegram', { method: 'POST', body: { initData: params.toString() } })).status, 401);
});
let ownConnection, foreignConnection;
test('accounts are scoped and never serialize credentials', async () => {
  ownConnection = await Connection.create({ owner, platform: 'facebook', providerId: '100', name: 'My account', credentials: seal({ access_token: 'private-access-token' }, owner) });
  foreignConnection = await Connection.create({ owner: other, platform: 'facebook', providerId: '200', name: 'Other account', credentials: seal({ access_token: 'foreign-token' }, other) });
  const r = await call('/accounts'); assert.equal(r.status, 200); assert.equal(r.data.accounts.length, 1); assert.equal(r.data.accounts[0].name, 'My account'); assert.ok(!JSON.stringify(r.data).includes('credentials')); assert.ok(!JSON.stringify(r.data).includes('token'));
  await call(`/accounts/${foreignConnection._id}`, { method: 'DELETE' }); assert.equal((await Connection.findById(foreignConnection._id)).status, 'connected');
});
test('OAuth includes PKCE, expires, and binds state to the browser', async () => {
  let binding;
  const req = { creator: { owner } }; const res = { cookie(name, value) { if (name === 'tpg_creator_oauth') binding = value; } };
  const url = new URL(await beginOAuth(req, res, 'youtube')); assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); assert.ok(url.searchParams.get('code_challenge'));
  const state = url.searchParams.get('state');
  await assert.rejects(() => finishOAuth({ query: { state, code: 'unused' }, headers: { cookie: 'tpg_creator_oauth=wrong' }, creator: { owner } }, res, 'youtube'));
  const record = await OAuth.findOne({ platform: 'youtube' }); assert.ok(record);
  // Cancel consumes the matching state; replay cannot exchange it.
  await assert.rejects(() => finishOAuth({ query: { state, error: 'access_denied' }, headers: { cookie: `tpg_creator_oauth=${binding}` }, creator: { owner } }, res, 'youtube'));
  assert.equal(await OAuth.countDocuments({ platform: 'youtube' }), 0);
});
test('draft creation is idempotent and rejects another owner’s destinations', async () => {
  const body = { title: '', caption: 'One post', targets: [String(ownConnection._id)], requestId: crypto.randomUUID() };
  const [a,b] = await Promise.all([call('/posts', { method: 'POST', body }), call('/posts', { method: 'POST', body })]); assert.equal(a.data._id, b.data._id);
  const bad = await call('/posts', { method: 'POST', body: { ...body, targets: [String(foreignConnection._id)], requestId: crypto.randomUUID() } }); assert.equal(bad.status, 400);
});
test('submission validates all destinations before enqueue and is idempotent', async () => {
  const post = await Post.create({ owner, requestId: crypto.randomUUID(), title: '', caption: 'x'.repeat(63207), targets: [String(ownConnection._id)] });
  assert.equal((await call(`/posts/${post._id}/submit`, { method: 'POST', body: {} })).status, 400);
  assert.equal((await Post.findById(post._id)).deliveries.length, 0);
  await Post.updateOne({ _id: post._id }, { caption: 'A short original post' });
  const first = await call(`/posts/${post._id}/submit`, { method: 'POST', body: {} }); const second = await call(`/posts/${post._id}/submit`, { method: 'POST', body: {} });
  assert.equal(first.data.deliveries[0]._id, second.data.deliveries[0]._id);
  assert.equal((await call(`/posts/${post._id}`, { method: 'PATCH', body: { title: '', caption: 'Changed', targets: [] } })).status, 409);
  assert.equal((await call(`/posts/${post._id}/submit`, { method: 'POST', headers: { cookie: cookieFor(other) }, body: {} })).status, 404);
});
test('atomic delivery claim prevents duplicate provider calls', async () => {
  let calls = 0;
  globalThis.fetch = async (url) => { assert.equal(String(url), 'https://graph.facebook.com/v25.0/100/feed'); calls++; return new Response(JSON.stringify({ id: '555' }), { status: 201 }); };
  const post = await Post.create({ owner, requestId: crypto.randomUUID(), caption: 'Test post', status: 'queued', scheduledAt: new Date(), deliveries: [{ connectionId: String(ownConnection._id), platform: 'facebook', name: 'My account', nextAt: new Date(), status: 'queued' }] });
  await Promise.all([runDelivery(post, post.deliveries[0]), runDelivery(post, post.deliveries[0])]);
  assert.equal(calls, 1); assert.equal((await Post.findById(post._id)).deliveries[0].status, 'published'); globalThis.fetch = originalFetch;
});
test('uncertain publication is flagged and not automatically resent', async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error('network lost private-access-token'); };
  const post = await Post.create({ owner, requestId: crypto.randomUUID(), caption: 'Uncertain', status: 'queued', scheduledAt: new Date(), deliveries: [{ connectionId: String(ownConnection._id), platform: 'facebook', name: 'My account', nextAt: new Date(), status: 'queued' }] });
  await runDelivery(post, post.deliveries[0]); const saved = await Post.findById(post._id); assert.equal(saved.deliveries[0].status, 'attention'); assert.ok(!saved.deliveries[0].message.includes('private-access-token'));
  await runDelivery(post, post.deliveries[0]); assert.equal(calls, 1); globalThis.fetch = originalFetch;
  assert.equal((await call(`/posts/${post._id}/retry/${post.deliveries[0]._id}`, { method: 'POST', body: {} })).status, 400);
});
test('future scheduling survives worker ticks and can return to draft', async () => {
  const post = await Post.create({ owner, requestId: crypto.randomUUID(), caption: 'Later', title: '', targets: [String(ownConnection._id)] });
  const future = new Date(Date.now() + 86400000).toISOString(); await call(`/posts/${post._id}/submit`, { method: 'POST', body: { scheduledAt: future } });
  // Remove other queued fixtures so this tick only inspects the future post.
  await Post.updateMany({ _id: { $ne: post._id } }, { status: 'published' });
  await tickQueue(); assert.equal((await Post.findById(post._id)).deliveries[0].attempts, 0);
  assert.equal((await call(`/posts/${post._id}/cancel`, { method: 'POST', body: {} })).data.status, 'draft');
});
test('TikTok never defaults privacy or interaction consent', () => {
  const account = { platform: 'tiktok', status: 'connected' }, media = { mime: 'video/mp4', duration: 20 }, info = { privacy_level_options: ['SELF_ONLY', 'PUBLIC_TO_EVERYONE'], max_video_post_duration_sec: 60, duet_disabled: true };
  assert.throws(() => validateContent({ caption: 'Original', settings: { tiktok: {} } }, account, media, info));
  assert.throws(() => validateContent({ caption: 'Original', settings: { tiktok: { privacy: 'SELF_ONLY', consent: true, branded: true } } }, account, media, info));
  assert.throws(() => validateContent({ caption: 'Original', settings: { tiktok: { privacy: 'PUBLIC_TO_EVERYONE', consent: true, duet: true } } }, account, media, info));
  assert.equal(validateContent({ caption: 'Original', settings: { tiktok: { privacy: 'SELF_ONLY', consent: true } } }, account, media, info), 'Original');
});
test('media links are signed, expiring and cannot change IDs', () => {
  const id = String(new mongoose.Types.ObjectId()), expires = Math.floor(Date.now()/1000) + 100;
  const signature = sign(`media:${id}:${expires}`); assert.equal(verifyMediaLink(id, expires, signature), true); assert.equal(verifyMediaLink(id, expires + 1, signature), false); assert.equal(verifyMediaLink('../secret', expires, signature), false);
});
test('live output allowlist and encoder never accept arbitrary shell URLs', () => {
  assert.equal(validIngest('rtmps://a.rtmps.youtube.com/live2/secret', 'youtube'), true);
  assert.equal(validIngest('rtmp://localhost/secret', 'youtube'), false); assert.equal(validIngest('rtmp://youtube.com.evil.test/x', 'youtube'), false);
  const args = encoderArgs('rtmps://a.rtmps.youtube.com/live2/key', true, '720'); assert.ok(args.includes('scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1')); assert.equal(args.at(-1), 'rtmps://a.rtmps.youtube.com/live2/key');
});
test('publication summary represents partial success accurately', () => { assert.equal(summarize([{ status: 'published' }, { status: 'failed' }]), 'partial'); assert.equal(summarize([{ status: 'processing' }]), 'queued'); });

test('guests can begin the four-platform flow but cannot access private Studio data', async () => {
  const response = await call('/accounts/facebook/connect', { method: 'POST', headers: { cookie: '' }, body: {} });
  assert.equal(response.status, 200); assert.equal(new URL(response.data.url).hostname, 'www.facebook.com');
  assert.equal((await call('/accounts', { headers: { cookie: '' } })).status, 401);
  assert.equal((await call('/accounts/x/connect', { method: 'POST', headers: { cookie: '' }, body: {} })).status, 400);
});
