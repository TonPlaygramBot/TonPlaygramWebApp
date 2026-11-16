import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const originalFetch = globalThis.fetch;
const oldToken = process.env.SPIN_INSTAGRAM_ACCESS_TOKEN;
const oldFallback = process.env.SPIN_INSTAGRAM_REEL_URL;
let moduleId = 0;
const freshService = () => import(`../services/spinInstagramReel.js?test=${moduleId++}`);
const response = (data, paging) => ({ ok: true, json: async () => ({ data, paging }) });
const reel = (id, timestamp) => ({
  media_type: 'VIDEO', permalink: `https://www.instagram.com/reel/${id}/`,
  timestamp, media_url: `https://cdn.example/${id}.mp4`, thumbnail_url: `https://cdn.example/${id}.jpg`
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (oldToken === undefined) delete process.env.SPIN_INSTAGRAM_ACCESS_TOKEN;
  else process.env.SPIN_INSTAGRAM_ACCESS_TOKEN = oldToken;
  if (oldFallback === undefined) delete process.env.SPIN_INSTAGRAM_REEL_URL;
  else process.env.SPIN_INSTAGRAM_REEL_URL = oldFallback;
});

test('selects the latest Reel by date and excludes photos and non-Reel videos', async () => {
  process.env.SPIN_INSTAGRAM_ACCESS_TOKEN = 'test-token';
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    assert.equal(url.origin, 'https://graph.instagram.com');
    assert.ok(url.searchParams.get('fields').includes('media_url'));
    return response([
      reel('old_pinned', '2026-11-01T00:00:00Z'),
      { ...reel('photo', '2026-11-16T12:00:00Z'), media_type: 'IMAGE' },
      { ...reel('feed', '2026-11-16T12:00:00Z'), permalink: 'https://www.instagram.com/p/feed/' },
      reel('newest', '2026-11-16T10:00:00Z'),
      reel('middle', '2026-11-15T00:00:00Z')
    ]);
  };
  const { getSpinInstagramReel } = await freshService();
  const result = await getSpinInstagramReel();
  assert.equal(result.reelUrl, 'https://www.instagram.com/reel/newest/');
  assert.equal(result.mediaUrl, 'https://cdn.example/newest.mp4');
  assert.ok(!JSON.stringify(result).includes('test-token'));
  await getSpinInstagramReel();
  assert.equal(calls, 1);
});

test('paginates past photos without following an external next-page URL', async () => {
  process.env.SPIN_INSTAGRAM_ACCESS_TOKEN = 'test-token';
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    assert.equal(url.origin, 'https://graph.instagram.com');
    if (calls === 1) return response([], { next: 'https://untrusted.example/', cursors: { after: 'page-2' } });
    assert.equal(url.searchParams.get('after'), 'page-2');
    return response([reel('latest', '2026-11-16T10:00:00Z')]);
  };
  const { getSpinInstagramReel } = await freshService();
  assert.equal((await getSpinInstagramReel()).mediaUrl, 'https://cdn.example/latest.mp4');
  assert.equal(calls, 2);
});

test('does not substitute an older video when the latest Reel lacks playable media', async () => {
  process.env.SPIN_INSTAGRAM_ACCESS_TOKEN = 'test-token';
  globalThis.fetch = async () => response([
    reel('old', '2026-11-15T10:00:00Z'),
    { ...reel('latest', '2026-11-16T10:00:00Z'), media_url: undefined }
  ]);
  const { getSpinInstagramReel } = await freshService();
  const result = await getSpinInstagramReel();
  assert.equal(result.reelUrl, 'https://www.instagram.com/reel/latest/');
  assert.equal(result.mediaUrl, null);
});

test('does not claim the profile URL is a playable Reel without an account token', async () => {
  delete process.env.SPIN_INSTAGRAM_ACCESS_TOKEN;
  process.env.SPIN_INSTAGRAM_REEL_URL = 'https://www.instagram.com/tonplaygram/';
  globalThis.fetch = async () => { throw new Error('must not fetch'); };
  const { getSpinInstagramReel } = await freshService();
  assert.deepEqual(await getSpinInstagramReel(), { reelUrl: null, mediaUrl: null, thumbnailUrl: null });
});
