import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sharp from 'sharp';
import sift from 'sift';
import User from '../models/User.js';
import WallFollow from '../models/WallFollow.js';
import router from '../routes/wallProfiles.js';
import { publicWallAvatar } from '../utils/wallIdentity.js';
import { notificationPostQuery } from '../services/wallNotifications.js';
import { memoryModel } from './helpers/wallMemoryModel.js';
let server, base;
const call = (path, method = 'GET', body, account = 'reader') =>
  fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(account ? { 'x-tpc-account-id': account } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
before(async () => {
  [User, WallFollow].forEach(memoryModel);
  await User.create({ accountId: 'reader', nickname: 'Reader' });
  await User.create({ accountId: 'creator', nickname: 'Creator' });
  const app = express();
  app.use(router);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  mock.restoreAll();
});
test('requires a signed-in account and rejects self/missing profiles', async () => {
  assert.equal((await call('/following', 'GET', undefined, '')).status, 401);
  assert.equal(
    (await call('/following/reader', 'PUT', { following: true })).status,
    400
  );
  assert.equal(
    (await call('/following/missing', 'PUT', { following: true })).status,
    404
  );
});
test('follows with notifications off by default, saves every-post choice, and unfollows only the current user', async () => {
  assert.equal(
    (await call('/following/creator', 'PUT', { following: true })).status,
    200
  );
  let saved = await (await call('/following')).json();
  assert.equal(saved.accountId, 'reader');
  assert.equal(saved.following.length, 1);
  assert.equal(saved.following[0].notify, false);
  await call('/following/creator', 'PUT', { following: true, notify: true });
  const follow = await WallFollow.findOne({
    followerAccountId: 'reader',
    authorAccountId: 'creator'
  }).lean();
  assert.equal(follow.notify, true);
  assert.ok(follow.notifySince);
  await call('/following/creator', 'PUT', { following: false });
  assert.deepEqual((await (await call('/following')).json()).following, []);
});
test('changes only the current account name and validates names before writing', async () => {
  const response = await call('/profile', 'PATCH', {
    name: 'My new name',
    accountId: 'creator'
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).author, 'My new name');
  assert.equal(
    (await User.findOne({ accountId: 'creator' })).nickname,
    'Creator'
  );
  for (const name of ['', 'a', 'a'.repeat(41), 'Name\nSpoof'])
    assert.equal((await call('/profile', 'PATCH', { name })).status, 400);
});
test('validates and resizes avatar bytes, marks custom photos, and returns a cache-versioned safe URL', async () => {
  const bytes = await sharp({
    create: { width: 400, height: 600, channels: 3, background: '#abcdef' }
  })
    .png()
    .toBuffer();
  const response = await call('/profile', 'PATCH', {
    name: 'My new name',
    photo: `data:image/png;base64,${bytes.toString('base64')}`
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.match(
    result.authorAvatar,
    /^\/api\/flamingo-wall\/profiles\/reader\/avatar\?v=[a-f0-9]{16}$/
  );
  const user = await User.findOne({ accountId: 'reader' });
  assert.equal(user.photoCustom, true);
  const metadata = await sharp(
    Buffer.from(user.photo.split(',')[1], 'base64')
  ).metadata();
  assert.equal(metadata.width, 256);
  assert.equal(metadata.height, 256);
  assert.equal(metadata.format, 'webp');
  assert.equal(publicWallAvatar(user.photo, 'reader'), result.authorAvatar);
  for (const photo of [
    'https://example.com/avatar.png',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/png;base64,YmFk'
  ])
    assert.equal(
      (await call('/profile', 'PATCH', { name: 'My new name', photo })).status,
      400
    );
});
test('creator-only notifications skip other, muted, old and own posts', () => {
  const now = new Date();
  const start = new Date(+now - 1000);
  const following = [
    {
      authorAccountId: 'creator',
      notify: true,
      notifySince: new Date(+now - 500)
    },
    { authorAccountId: 'muted', notify: false, notifySince: start }
  ];
  const query = notificationPostQuery(
    { accountId: 'reader', since: start, scope: 'following' },
    now,
    following
  );
  const match = (sift.default || sift)(query);
  assert.equal(
    match({ authorAccountId: 'creator', createdAt: new Date(+now - 200) }),
    true
  );
  for (const authorAccountId of ['other', 'muted', 'reader'])
    assert.equal(match({ authorAccountId, createdAt: now }), false);
  assert.equal(
    match({ authorAccountId: 'creator', createdAt: new Date(+now - 700) }),
    false
  );
  assert.equal(
    (sift.default || sift)(
      notificationPostQuery(
        { accountId: 'reader', since: start, scope: 'following' },
        now,
        []
      )
    )({ authorAccountId: 'other', createdAt: now }),
    false
  );
  const all = (sift.default || sift)(
    notificationPostQuery(
      { accountId: 'reader', since: start, scope: 'all' },
      now,
      following
    )
  );
  assert.equal(all({ authorAccountId: 'muted', createdAt: now }), false);
  assert.equal(all({ authorAccountId: 'other', createdAt: now }), true);
});
