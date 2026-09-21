import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { memoryModel } from './helpers/wallMemoryModel.js';
import express from 'express';
import webPush from 'web-push';
import User from '../models/User.js';
import FlamingoPost from '../models/FlamingoPost.js';
import WallSubscription from '../models/WallSubscription.js';
import WallFollow from '../models/WallFollow.js';
import router from '../routes/wallNotifications.js';
import {
  wallUserSelector,
  publicWallAvatar,
  hydrateWallAuthors
} from '../utils/wallIdentity.js';
import {
  browserSubscriptionId,
  validateBrowserSubscription,
  wallPushKeys,
  createWallNotificationWorker,
  permanentNotificationFailure,
  deliverWallNotification
} from '../services/wallNotifications.js';

let server, base;
// In-memory repository doubles let delivery/restart/consent behavior run without
// a MongoDB daemon or any outbound Telegram/browser messages.
const originalToken = process.env.BOT_TOKEN;
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test-device',
  keys: {
    p256dh: webPush.generateVAPIDKeys().publicKey,
    auth: Buffer.alloc(16, 2).toString('base64url')
  }
};
const call = (path = '', method = 'GET', body, accountId = 'wall-reader') =>
  fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(accountId ? { 'x-tpc-account-id': accountId } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
before(async () => {
  [
    User,
    FlamingoPost,
    WallFollow,
    WallSubscription,
    mongoose.model('WallPushKey')
  ].forEach(memoryModel);
  mongoose.connection._readyState = 1;
  await User.create({
    accountId: 'wall-reader',
    googleId: 'google-reader',
    firstName: 'Alice',
    lastName: 'Reader',
    telegramId: 1001
  });
  await User.create({
    accountId: 'wall-author',
    nickname: 'Bob',
    photo: 'https://api.telegram.org/file/botsecret/photos/file_1.jpg'
  });
  process.env.BOT_TOKEN = 'test-only-token';
  const app = express();
  app.use('/notifications', router);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/notifications`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  mongoose.connection._readyState = 0;
  mock.restoreAll();
  if (originalToken === undefined) delete process.env.BOT_TOKEN;
  else process.env.BOT_TOKEN = originalToken;
});

test('uses active provider identity ahead of a stale guest account and proxies Telegram avatars', async () => {
  assert.deepEqual(wallUserSelector({ telegramId: 1001, accountId: 'old' }), {
    telegramId: 1001
  });
  assert.deepEqual(
    wallUserSelector({ googleId: 'google-reader', accountId: 'old' }),
    { googleId: 'google-reader' }
  );
  const [post] = await hydrateWallAuthors([
    { author: 'Community member', authorAccountId: 'wall-author' }
  ]);
  assert.equal(post.author, 'Bob');
  assert.equal(
    post.authorAvatar,
    '/api/flamingo-wall/profiles/wall-author/avatar'
  );
  assert.equal(
    publicWallAvatar(
      'https://api.telegram.org/file/botsecret/photos/file_1.jpg'
    ),
    ''
  );
});
test('validates browser push endpoints and encryption keys', () => {
  assert.deepEqual(validateBrowserSubscription(subscription), subscription);
  for (const endpoint of [
    'http://fcm.googleapis.com/x',
    'https://localhost/x',
    'https://127.0.0.1/x',
    'https://fcm.googleapis.com.evil.test/x',
    'https://fcm.googleapis.com:8443/x',
    'https://user:password@fcm.googleapis.com/x'
  ]) {
    assert.equal(
      validateBrowserSubscription({ ...subscription, endpoint }),
      null
    );
  }
  assert.equal(
    validateBrowserSubscription({
      ...subscription,
      keys: { auth: 'bad', p256dh: 'bad' }
    }),
    null
  );
});
test('defaults to opt-out, requires an account, and never exposes private VAPID keys', async () => {
  assert.equal((await call('', 'GET', undefined, '')).status, 401);
  const settings = await (await call()).json();
  assert.equal(settings.telegramEnabled, false);
  assert.equal(settings.telegramAvailable, true);
  assert.ok(settings.publicKey);
  assert.equal(settings.privateKey, undefined);
  const keys = await wallPushKeys();
  assert.equal(keys.publicKey, settings.publicKey);
  assert.ok(keys.privateKey);
  const stored = await mongoose.model('WallPushKey').findById('vapid').lean();
  assert.equal(stored.privateKey, undefined);
});
test('persists browser opt-in, preserves the cursor on retries, scopes opt-out to the account', async () => {
  assert.equal(
    (await call('/browser', 'PUT', { enabled: true, subscription })).status,
    200
  );
  const id = browserSubscriptionId(subscription.endpoint);
  const first = await WallSubscription.findById(id).lean();
  assert.equal(
    (
      await (
        await call('/browser/status', 'POST', {
          endpoint: subscription.endpoint
        })
      ).json()
    ).enabled,
    true
  );
  await call('/browser', 'PUT', { enabled: true, subscription });
  assert.equal(
    +(await WallSubscription.findById(id).lean()).since,
    +first.since
  );
  await call(
    '/browser',
    'PUT',
    { enabled: false, subscription },
    'wall-author'
  );
  assert.equal((await WallSubscription.findById(id).lean()).enabled, true);
  await call('/browser', 'PUT', { enabled: false, subscription });
  assert.equal((await WallSubscription.findById(id).lean()).enabled, false);
});
test('delivers new posts and videos once across worker restarts, skips old/self posts, and honors opt-out', async () => {
  await call('/telegram', 'PUT', { enabled: true });
  const sub = await WallSubscription.findById('telegram:wall-reader').lean();
  await FlamingoPost.create({
    author: 'Old author',
    text: 'Before opt-in',
    createdAt: new Date(+sub.since - 1000)
  });
  await FlamingoPost.create({
    author: 'Self',
    authorAccountId: 'wall-reader',
    createdAt: new Date(+sub.since + 1)
  });
  const timestamp = new Date(+sub.since + 2);
  const post = await FlamingoPost.create({
    author: 'Community member',
    authorAccountId: 'wall-author',
    text: 'New post',
    createdAt: timestamp
  });
  const video = await FlamingoPost.create({
    author: 'Bob',
    authorAccountId: 'wall-author',
    attachment: { name: 'clip.mp4', type: 'video/mp4', url: '/video.mp4' },
    createdAt: timestamp
  });
  const sent = [];
  const deliver = async (sub, post) => {
    sent.push({
      id: String(post._id),
      author: post.author,
      channel: sub.channel
    });
  };
  // Clock reaches the two publications before the worker runs.
  await new Promise((resolve) => setTimeout(resolve, 10));
  await createWallNotificationWorker({}, deliver)();
  assert.deepEqual(
    sent.map((item) => item.id),
    [String(post._id), String(video._id)]
  );
  assert.ok(
    sent.every((item) => item.author === 'Bob' && item.channel === 'telegram')
  );
  await WallSubscription.updateMany({}, { $set: { nextCheckAt: new Date(0) } });
  await createWallNotificationWorker({}, deliver)();
  assert.equal(sent.length, 2);
  await call('/telegram', 'PUT', { enabled: false });
  await FlamingoPost.create({ author: 'Bob', text: 'After opt-out' });
  await createWallNotificationWorker({}, deliver)();
  assert.equal(sent.length, 2);
});
test('sends Telegram messages through the existing bot with a post link, and retires expired channels', async () => {
  const sent = [];
  await deliverWallNotification(
    { channel: 'telegram', telegramId: 1001 },
    { _id: '000000000000000000000001', author: 'Alice', text: 'Hello' },
    { sendMessage: (...args) => sent.push(args) }
  );
  assert.equal(sent[0][0], 1001);
  assert.match(sent[0][1], /New post\nAlice: Hello/);
  assert.match(
    sent[0][2].reply_markup.inline_keyboard[0][0].url,
    /\/wall#post-000000000000000000000001$/
  );
  assert.equal(
    permanentNotificationFailure('browser', { statusCode: 410 }),
    true
  );
  assert.equal(
    permanentNotificationFailure('browser', { statusCode: 500 }),
    false
  );
  assert.equal(
    permanentNotificationFailure('telegram', { response: { error_code: 403 } }),
    true
  );
});

test('browser delivery includes encrypted push credentials and only the public post payload', async () => {
  const calls = [];
  await deliverWallNotification(
    { channel: 'browser', subscription },
    {
      _id: '000000000000000000000002',
      author: 'Alice',
      attachment: { type: 'video/mp4' }
    },
    null,
    { sendNotification: (...args) => calls.push(args) }
  );
  assert.deepEqual(calls[0][0], subscription);
  assert.match(JSON.parse(calls[0][1]).title, /New video/);
  assert.ok(calls[0][2].vapidDetails.privateKey);
  assert.equal(JSON.parse(calls[0][1]).privateKey, undefined);
  assert.equal(calls[0][2].timeout, 8000);
});
test('retries transient delivery failures without advancing the cursor and disables expired subscriptions', async () => {
  await call('/browser', 'PUT', { enabled: true, subscription });
  const id = browserSubscriptionId(subscription.endpoint);
  const since = new Date(Date.now() - 1000);
  await WallSubscription.updateOne(
    { _id: id },
    { $set: { since, lastPostId: null, nextCheckAt: new Date(0) } }
  );
  await FlamingoPost.create({ author: 'Bob', text: 'Retry this delivery' });
  await createWallNotificationWorker(null, async () => {
    throw { statusCode: 503 };
  })();
  let saved = await WallSubscription.findById(id).lean();
  assert.equal(+saved.since, +since);
  assert.equal(saved.enabled, true);
  assert.equal(saved.failureCount, 1);
  assert.ok(+saved.nextCheckAt > Date.now());
  await WallSubscription.updateOne(
    { _id: id },
    { $set: { nextCheckAt: new Date(0) } }
  );
  await createWallNotificationWorker(null, async () => {
    throw { statusCode: 410 };
  })();
  saved = await WallSubscription.findById(id).lean();
  assert.equal(saved.enabled, false);
});
