import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { OAuth } from '../creator/models.js';
import { beginOAuth, finishOAuth } from '../creator/oauth.js';
afterEach(() => mock.restoreAll());

test('the Social OAuth destination stays bound to a one-time, browser-bound record', async () => {
  const original = { ...process.env };
  process.env.CREATOR_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
  process.env.CREATOR_PUBLIC_URL = 'https://tpg.example';
  process.env.CREATOR_GOOGLE_CLIENT_ID = 'test-client';
  process.env.CREATOR_GOOGLE_CLIENT_SECRET = 'test-secret';
  try {
    let pending, binding;
    mock.method(OAuth, 'create', async record => { pending = record; });
    mock.method(OAuth, 'findOneAndDelete', async query => {
      if (!pending || query.stateHash !== pending.stateHash || query.binding !== pending.binding || query.platform !== pending.platform) return null;
      const record = pending; pending = null; return record;
    });
    mock.method(globalThis, 'fetch', async url => new Response(JSON.stringify(String(url).includes('/token') ? { access_token: 'test-token' } : { sub: 'existing-user', name: 'Existing user' })));
    for (const [returnTo, error, expected] of [
      ['/social-app/creator-studio', undefined, '/social-app/creator-studio'],
      ['/social-app/creator-studio', 'access_denied', '/social-app/creator-studio'],
      ['https://evil.example/', undefined, '/creator-studio']
    ]) {
      const res = { locals: {}, cookie(name, value) { if (name === 'tpg_creator_oauth' && value) binding = value; } };
      const url = new URL(await beginOAuth({ body: { returnTo } }, res, 'google'));
      const req = { query: { state: url.searchParams.get('state'), code: 'test-code', error }, headers: { cookie: `tpg_creator_oauth=${binding}` } };
      await assert.rejects(() => finishOAuth({ ...req, headers: { cookie: 'tpg_creator_oauth=wrong' } }, res, 'google'));
      assert.equal(res.locals.creatorReturnTo, undefined);
      assert.ok(pending, 'mismatched browser does not consume the valid record');
      if (error) await assert.rejects(() => finishOAuth(req, res, 'google'));
      else await finishOAuth(req, res, 'google');
      assert.equal(res.locals.creatorReturnTo, expected);
      assert.equal(pending, null);
      await assert.rejects(() => finishOAuth(req, { ...res, locals: {} }, 'google'));
    }
  } finally {
    for (const key of ['CREATOR_ENCRYPTION_KEY', 'CREATOR_PUBLIC_URL', 'CREATOR_GOOGLE_CLIENT_ID', 'CREATOR_GOOGLE_CLIENT_SECRET']) {
      if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
    }
  }
});
