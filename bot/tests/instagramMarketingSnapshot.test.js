import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readInstagramMarketingSnapshot } from '../services/instagramMarketingSnapshot.js';

const token = 'fake-test-token';
const fixedTime = new Date('2026-11-22T10:19:00Z');
const args = { accountId: '101', mediaId: '201', token, now: () => fixedTime };
const exampleAccount = { id: '101', followers_count: 54, username: 'never-reported' };
const exampleReel = { id: '201', owner: { id: '101' }, media_product_type: 'REELS',
  total_views_count: 300, shares_count: 0, total_comments_count: 3, comments: { ignored: true } };

function fixture(account = exampleAccount, reel = exampleReel, requests = []) {
  return async (url, options) => {
    requests.push({url, options});
    return { ok: true, json: async () => url.pathname.endsWith('/101') ? account : reel };
  };
}

test('only fixed official aggregate reads; secret never in URL and player data not returned', async () => {
  const requests = [];
  const data = await readInstagramMarketingSnapshot({ ...args, fetchImpl: fixture(undefined, undefined, requests) });
  assert.deepEqual(data, { source: 'meta-aggregate', observedAt: fixedTime.toISOString(),
    mediaId: '201', followers: 54, views: 300, comments: 3, shares: 0 });
  assert.deepEqual(requests.map(({url}) => url.pathname), ['/v27.0/101', '/v27.0/201']);
  for (const {url, options} of requests) {
    assert.equal(url.origin, 'https://graph.facebook.com');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(url.searchParams.has('access_token'), false);
  }
});

test('missing metric differs from zero; invalid numbers are unknown', async () => {
  const data = await readInstagramMarketingSnapshot({ ...args,
    fetchImpl: fixture({ id: '101' }, {...exampleReel, total_views_count: '300', total_comments_count: -1}) });
  assert.equal(data.followers, null);
  assert.equal(data.views, null);
  assert.equal(data.comments, null);
  assert.equal(data.shares, 0);
});

test('wrong account, Reel, owner, product or missing ownership cannot report metrics', async () => {
  for (const mod of [{id:'202'}, {owner:{id:'102'}}, {owner:null}, {media_product_type:'FEED'}]) {
    await assert.rejects(readInstagramMarketingSnapshot({ ...args,
      fetchImpl: fixture(undefined, { ...exampleReel, ...mod }) }), /ownership not verified/);
  }
  await assert.rejects(readInstagramMarketingSnapshot({ ...args,
    fetchImpl: fixture({ ...exampleAccount, id:'102' }) }), /ownership not verified/);
});

test('missing configuration makes no requests', async () => {
  let calls=0;
  await assert.rejects(readInstagramMarketingSnapshot({ ...args, mediaId: '201/anything',
    fetchImpl: async () => { calls++; } }), /not configured/);
  await assert.rejects(readInstagramMarketingSnapshot({ ...args, token: '',
    fetchImpl: async () => { calls++; } }), /not configured/);
  assert.equal(calls,0);
});

test('HTTP, provider and transport errors are fail-closed and redacted', async () => {
  for (const fetchImpl of [
    async () => ({ok:false}),
    async () => ({ok:true,json:async()=>({error:{message:token}})}),
    async () => { throw new Error(token); }
  ]) {
    await assert.rejects(readInstagramMarketingSnapshot({ ...args, fetchImpl }),
      {message:'Instagram marketing data unavailable'});
  }
});
