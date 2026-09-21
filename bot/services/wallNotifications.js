import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import webPush from 'web-push';
import FlamingoPost from '../models/FlamingoPost.js';
import WallSubscription from '../models/WallSubscription.js';
import WallFollow from '../models/WallFollow.js';
import { hydrateWallAuthors } from '../utils/wallIdentity.js';

const keySchema = new mongoose.Schema({
  _id: String,
  publicKey: String,
  privateKey: { type: String, select: false }
});
const PushKey = mongoose.model('WallPushKey', keySchema);
let keyPromise;
export const webappOrigin = () =>
  new URL(process.env.WEBAPP_BASE_URL || 'https://tonplaygram-bot.onrender.com')
    .origin;
export function wallPushKeys() {
  if (!keyPromise)
    keyPromise = (async () => {
      // Stored in MongoDB, so a Render deploy/restart does not invalidate opt-ins.
      const existing = await PushKey.findById('vapid')
        .select('+privateKey')
        .lean();
      if (existing) return existing;
      try {
        return await PushKey.findOneAndUpdate(
          { _id: 'vapid' },
          { $setOnInsert: webPush.generateVAPIDKeys() },
          { upsert: true, new: true }
        )
          .select('+privateKey')
          .lean();
      } catch (error) {
        if (error.code !== 11000) throw error;
        return PushKey.findById('vapid').select('+privateKey').lean();
      }
    })().catch((error) => {
      keyPromise = undefined;
      throw error;
    });
  return keyPromise;
}
export const browserSubscriptionId = (endpoint) =>
  `browser:${createHash('sha256').update(endpoint).digest('hex')}`;
export function validateBrowserSubscription(value) {
  let url;
  try {
    url = new URL(value?.endpoint);
  } catch {
    return null;
  }
  const host = url.hostname;
  const allowed =
    host === 'fcm.googleapis.com' ||
    host === 'updates.push.services.mozilla.com' ||
    host.endsWith('.push.services.mozilla.com') ||
    host === 'web.push.apple.com' ||
    host.endsWith('.push.apple.com') ||
    host.endsWith('.notify.windows.com');
  if (
    !allowed ||
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    url.href.length > 2048
  )
    return null;
  const { p256dh, auth } = value?.keys || {};
  if (
    typeof p256dh !== 'string' ||
    typeof auth !== 'string' ||
    !/^[\w-]{87}=?$/.test(p256dh) ||
    !/^[\w-]{22}={0,2}$/.test(auth)
  )
    return null;
  const key = Buffer.from(p256dh, 'base64url');
  if (
    key.length !== 65 ||
    key[0] !== 4 ||
    Buffer.from(auth, 'base64url').length !== 16
  )
    return null;
  return { endpoint: url.href, keys: { p256dh, auth } };
}
export function notificationPostQuery(
  subscription,
  now = new Date(),
  following = []
) {
  const floor = new Date(
    Math.max(
      new Date(subscription.since).getTime(),
      now.getTime() - 24 * 60 * 60_000
    )
  );
  return {
    authorAccountId: { $ne: subscription.accountId },
    ...(subscription.scope === 'following'
      ? {
          $and: [
            {
              $or: following
                .filter((row) => row.notify)
                .map((row) => ({
                  authorAccountId: row.authorAccountId,
                  createdAt: { $gte: row.notifySince }
                }))
                .concat([{ authorAccountId: { $in: [] } }])
            }
          ]
        }
      : {
          $and: [
            {
              authorAccountId: {
                $nin: following
                  .filter((row) => !row.notify)
                  .map((row) => row.authorAccountId)
              }
            }
          ]
        }),
    $or: [
      { createdAt: { $gt: floor, $lte: now } },
      ...(subscription.lastPostId && +floor === +new Date(subscription.since)
        ? [{ createdAt: floor, _id: { $gt: subscription.lastPostId } }]
        : [])
    ]
  };
}
export function wallNotification(post) {
  const video = post.attachment?.type?.startsWith('video/');
  return {
    title: `TonPlayGram · New ${video ? 'video' : 'post'}`,
    body: `${post.author || 'A member'}: ${post.title || post.text || (video ? 'Shared a video' : 'Shared a post')}`.slice(
      0,
      180
    ),
    url: `/wall#post-${post._id}`,
    tag: `wall-${post._id}`
  };
}
export function permanentNotificationFailure(channel, error) {
  const code = Number(error.statusCode || error.response?.error_code);
  return channel === 'browser'
    ? [404, 410].includes(code)
    : [400, 403].includes(code);
}
export async function deliverWallNotification(
  subscription,
  post,
  telegram,
  push = webPush
) {
  const notification = wallNotification(post);
  if (subscription.channel === 'telegram') {
    if (!telegram) throw new Error('Telegram notifications are unavailable');
    return telegram.sendMessage(
      subscription.telegramId,
      `${notification.title}\n${notification.body}`,
      {
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Open social wall',
                url: `${webappOrigin()}${notification.url}`
              }
            ]
          ]
        }
      }
    );
  }
  const keys = await wallPushKeys();
  return push.sendNotification(
    subscription.subscription,
    JSON.stringify(notification),
    {
      vapidDetails: {
        subject: webappOrigin(),
        publicKey: keys.publicKey,
        privateKey: keys.privateKey
      },
      TTL: 3600,
      timeout: 8000,
      urgency: 'normal',
      topic: String(post._id)
    }
  );
}

export function createWallNotificationWorker(
  telegram,
  deliver = deliverWallNotification
) {
  let busy = false;
  const run = async () => {
    if (busy || mongoose.connection.readyState !== 1) return;
    busy = true;
    try {
      // Bounded work per tick; each subscription's lease prevents concurrent
      // Render instances from sending it simultaneously.
      for (let count = 0; count < 20; count++) {
        const now = new Date();
        const subscription = await WallSubscription.findOneAndUpdate(
          {
            enabled: true,
            nextCheckAt: { $lte: now },
            lockedUntil: { $lte: now }
          },
          {
            $set: {
              lockedUntil: new Date(+now + 10 * 60_000),
              nextCheckAt: new Date(+now + 15_000)
            }
          },
          { sort: { nextCheckAt: 1 }, new: true }
        ).lean();
        if (!subscription) break;
        // Match the lease and opt-in version so a concurrent opt-out/re-enable
        // cannot be overwritten by an earlier delivery finishing.
        const owner = {
          _id: subscription._id,
          enabled: true,
          lockedUntil: subscription.lockedUntil,
          since: subscription.since
        };
        try {
          const following = await WallFollow.find({
            followerAccountId: subscription.accountId
          }).lean();
          const post = await FlamingoPost.findOne(
            notificationPostQuery(subscription, now, following)
          )
            .sort({ createdAt: 1, _id: 1 })
            .lean();
          if (post && (await WallSubscription.exists(owner))) {
            const [hydrated] = await hydrateWallAuthors([post]);
            await deliver(subscription, hydrated, telegram);
          }
          await WallSubscription.updateOne(owner, {
            $set: {
              ...(post
                ? {
                    since: post.createdAt,
                    lastPostId: post._id,
                    nextCheckAt: new Date()
                  }
                : {}),
              lockedUntil: new Date(0),
              failureCount: 0
            }
          });
        } catch (error) {
          const disabled = permanentNotificationFailure(
            subscription.channel,
            error
          );
          const delay = Math.min(
            60 * 60_000,
            30_000 * 2 ** Math.min(subscription.failureCount, 7)
          );
          await WallSubscription.updateOne(owner, {
            $set: {
              ...(disabled ? { enabled: false } : {}),
              lockedUntil: new Date(0),
              nextCheckAt: new Date(Date.now() + delay)
            },
            $inc: { failureCount: 1 }
          });
          // Do not log push endpoints, keys, user IDs, or Telegram payloads.
          console.warn(
            'Wall notification delivery:',
            subscription.channel,
            disabled ? 'subscription expired' : 'retry scheduled'
          );
        }
      }
    } catch (error) {
      console.warn('Wall notification worker unavailable:', error.name);
    } finally {
      busy = false;
    }
  };
  return run;
}

export function startWallNotifications(telegram) {
  const run = createWallNotificationWorker(telegram);
  void run();
  const timer = setInterval(() => void run(), 10_000);
  timer.unref();
  return () => clearInterval(timer);
}
