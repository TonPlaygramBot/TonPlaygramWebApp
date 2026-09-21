import express from 'express';
import rateLimit from 'express-rate-limit';
import authenticate from '../middleware/auth.js';
import { resolveWallUser } from '../utils/wallIdentity.js';
import WallSubscription from '../models/WallSubscription.js';
import {
  browserSubscriptionId,
  validateBrowserSubscription,
  wallPushKeys
} from '../services/wallNotifications.js';

const router = express.Router();
router.use(authenticate, express.json({ limit: '8kb' }));
router.use(
  rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false
  })
);
router.use(async (req, res, next) => {
  try {
    const user = await resolveWallUser(req);
    if (!user?.accountId)
      return res
        .status(401)
        .json({ error: 'Sign in to receive wall notifications.' });
    req.wallUser = user;
    res.setHeader('Cache-Control', 'no-store');
    next();
  } catch {
    res
      .status(503)
      .json({ error: 'Notification settings are temporarily unavailable.' });
  }
});
router.get('/', async (req, res) => {
  try {
    const user = req.wallUser;
    const [telegram, keys] = await Promise.all([
      WallSubscription.findOne({
        _id: `telegram:${user.accountId}`,
        enabled: true
      }),
      wallPushKeys()
    ]);
    res.json({
      accountId: user.accountId,
      telegramAvailable: Boolean(user.telegramId && process.env.BOT_TOKEN),
      telegramEnabled: Boolean(telegram),
      telegramScope: telegram?.scope || 'all',
      publicKey: keys.publicKey
    });
  } catch {
    res
      .status(503)
      .json({ error: 'Notification settings are temporarily unavailable.' });
  }
});
router.post('/browser/status', async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint !== 'string' || endpoint.length > 2048)
      return res.status(400).json({ error: 'Invalid subscription.' });
    const enabled = await WallSubscription.findOne({
      _id: browserSubscriptionId(endpoint),
      accountId: req.wallUser.accountId,
      enabled: true
    });
    res.json({ enabled: Boolean(enabled), scope: enabled?.scope || 'all' });
  } catch {
    res
      .status(503)
      .json({ error: 'Notification settings are temporarily unavailable.' });
  }
});
router.put('/scope', async (req, res) => {
  const { scope } = req.body || {};
  if (!['all', 'following'].includes(scope))
    return res.status(400).json({ error: 'Choose whose posts to receive.' });
  try {
    await WallSubscription.updateMany(
      { accountId: req.wallUser.accountId },
      { $set: { scope } }
    );
    res.json({ scope });
  } catch {
    res.status(503).json({ error: 'Could not save notification settings.' });
  }
});
router.put('/:channel', async (req, res) => {
  try {
    const { channel } = req.params;
    const { enabled, scope = 'all' } = req.body || {};
    if (
      !['browser', 'telegram'].includes(channel) ||
      typeof enabled !== 'boolean' ||
      !['all', 'following'].includes(scope)
    )
      return res.status(400).json({ error: 'Choose a notification option.' });
    const user = req.wallUser;
    let id, details;
    if (channel === 'browser') {
      const subscription = validateBrowserSubscription(req.body.subscription);
      if (!subscription)
        return res
          .status(400)
          .json({ error: 'Invalid browser push subscription.' });
      id = browserSubscriptionId(subscription.endpoint);
      details = { subscription };
    } else {
      if (!user.telegramId || !process.env.BOT_TOKEN)
        return res
          .status(400)
          .json({ error: 'Connect Telegram first to receive messages there.' });
      id = `telegram:${user.accountId}`;
      details = { telegramId: user.telegramId };
    }
    if (!enabled) {
      await WallSubscription.updateOne(
        { _id: id, accountId: user.accountId },
        { $set: { enabled: false, lockedUntil: new Date(0) } }
      );
    } else {
      const existing = await WallSubscription.findById(id).lean();
      // Repeated enable/refresh calls keep the cursor. A fresh opt-in begins now.
      const fresh = !existing?.enabled || existing.accountId !== user.accountId;
      await WallSubscription.updateOne(
        { _id: id },
        {
          $set: {
            accountId: user.accountId,
            channel,
            enabled: true,
            scope,
            ...details,
            ...(fresh
              ? {
                  since: new Date(),
                  lastPostId: null,
                  nextCheckAt: new Date(),
                  lockedUntil: new Date(0),
                  failureCount: 0
                }
              : {})
          }
        },
        { upsert: true }
      );
    }
    res.json({ enabled });
  } catch {
    res
      .status(503)
      .json({ error: 'Could not save notification settings. Please retry.' });
  }
});
export default router;
