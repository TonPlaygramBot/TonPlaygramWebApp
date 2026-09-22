import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { seal, unseal, configured, session, issueSession, sign, csrf } from '../creator/security.js';
import { validIngest, encoderArgs, endDestination } from '../creator/live.js';
import { verifyMediaLink } from '../creator/media.js';
import { summarize } from '../creator/queue.js';
import { validateContent } from '../creator/publishers.js';
process.env.CREATOR_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.CREATOR_PUBLIC_URL = 'https://studio.example';
test('encrypted tokens cannot move between owners or survive tampering', () => {
  const encrypted = seal({ access_token: 'secret' }, 'google:one');
  assert.equal(unseal(encrypted, 'google:one').access_token, 'secret');
  assert.throws(() => unseal(encrypted, 'google:two'));
  assert.throws(() => unseal(encrypted.slice(0, -4), 'google:one'));
});
test('missing studio configuration fails closed without import failure', () => {
  const key = process.env.CREATOR_ENCRYPTION_KEY; delete process.env.CREATOR_ENCRYPTION_KEY; assert.equal(configured(), false); process.env.CREATOR_ENCRYPTION_KEY = key; assert.equal(configured(), true);
});
test('sessions require a signed subject and future expiry', () => {
  let cookie; issueSession({ cookie: (name, value) => { cookie = `${name}=${value}`; } }, 'google:one', 'Test');
  assert.equal(session({ headers: { cookie } }).owner, 'google:one');
  assert.equal(session({ headers: { cookie: cookie + 'x' } }), null);
  assert.equal(session({ headers: { 'x-google-id': 'one' } }), null);
  const old = Buffer.from(JSON.stringify({ owner: 'google:one', exp: Date.now()-1000 })).toString('base64url');
  assert.equal(session({ headers: { cookie: `tpg_creator=${old}.${sign(old)}` } }), null);
});
test('CSRF checks require the exact configured origin and a non-simple header', () => {
  let error;
  csrf({ method: 'POST', get: name => name === 'origin' ? 'https://evil.example' : '1' }, {}, e => { error = e; }); assert.equal(error.status, 403);
  csrf({ method: 'POST', get: name => name === 'origin' ? 'https://studio.example' : '1' }, {}, e => { error = e; }); assert.equal(error, undefined);
});
test('signed media cannot be extended, redirected or reused for a different file', () => {
  const id = '123456789012345678901234', expiry = Math.floor(Date.now()/1000) + 100;
  const signature = sign(`media:${id}:${expiry}`);
  assert.equal(verifyMediaLink(id, expiry, signature), true); assert.equal(verifyMediaLink(id, expiry+100, signature), false); assert.equal(verifyMediaLink('../file', expiry, signature), false);
});
test('live ingest allowlist excludes local and unrelated hosts', () => {
  for (const url of ['rtmp://127.0.0.1/app/a','rtmp://youtube.com.attacker.test/a','file:///etc/passwd']) assert.equal(validIngest(url, 'youtube'), false);
  assert.equal(validIngest('rtmps://a.rtmps.youtube.com/live2/a', 'youtube'), true);
  assert.equal(validIngest('rtmp://sfo.contribute.live-video.net/app/a', 'twitch'), false);
  assert.ok(encoderArgs('rtmps://a.rtmps.youtube.com/live2/a', true, '720').includes('scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1'));
});
test('platform validation catches incompatible media and missing audience consent', () => {
  assert.throws(() => validateContent({caption:'hello'}, {platform:'x', status:'connected'}, {mime:'video/mp4'}));
  assert.throws(() => validateContent({caption:'hello',title:'Video',settings:{youtubePrivacy:'public'}}, {platform:'youtube',status:'connected'}, {mime:'video/mp4'}));
  const info = { privacy_level_options: ['SELF_ONLY'], max_video_post_duration_sec: 60 };
  assert.throws(() => validateContent({caption:'Hi',settings:{tiktok:{}}}, {platform:'tiktok',status:'connected'}, {mime:'video/mp4',duration:10},info));
  assert.equal(summarize([{status:'published'},{status:'attention'}]),'partial');
});
test('ending a YouTube broadcast preserves completed archives and never deletes after a failed transition', async () => {
  const original = globalThis.fetch;
  const account = { _id: 'test-youtube', owner: 'google:one', status: 'connected', platform: 'youtube', credentials: seal({ access_token: 'test' }, 'google:one') };
  const calls = [];
  try {
    globalThis.fetch = async (url, options) => { calls.push(options.method); return new Response(JSON.stringify({ items: [{ status: { lifeCycleStatus: 'complete' } }] })); };
    await endDestination(account, { broadcast: 'completed-video' });
    assert.deepEqual(calls, ['GET']);
    calls.length = 0;
    globalThis.fetch = async (url, options) => { calls.push(options.method); if (options.method === 'POST') return new Response('{}', { status: 503 }); return new Response(JSON.stringify({ items: [{ status: { lifeCycleStatus: 'live' } }] })); };
    await assert.rejects(() => endDestination(account, { broadcast: 'live-video' }));
    assert.deepEqual(calls, ['GET', 'POST']);
  } finally { globalThis.fetch = original; }
});
