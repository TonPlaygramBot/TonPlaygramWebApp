import { Router } from 'express';

import User from '../models/User.js';

import Airdrop from '../models/Airdrop.js';

import { ensureTransactionArray } from '../utils/userUtils.js';
import bot from '../bot.js';
import { sendTPCNotification } from '../utils/notifications.js';
import authenticate from '../middleware/auth.js';
import AirdropVideo from '../models/AirdropVideo.js';
import AirdropVideoClaim from '../models/AirdropVideoClaim.js';
import { hasSocialDeveloperAccess } from './socialAdmin.js';

const router = Router();

router.post('/videos', authenticate, async (req, res) => {
  const telegramId = req.auth?.telegramId;
  const videos = await AirdropVideo.find({ active: true }).sort({ createdAt: -1 }).lean();
  const claims = telegramId
    ? await AirdropVideoClaim.find({ telegramId, videoId: { $in: videos.map((video) => video._id) } }).lean()
    : [];
  const claimed = new Set(claims.map((claim) => String(claim.videoId)));
  res.json(videos.map((video) => ({ ...video, claimed: claimed.has(String(video._id)) })));
});

router.post('/videos/claim', authenticate, async (req, res) => {
  const telegramId = req.auth?.telegramId;
  if (!telegramId) return res.status(403).json({ error: 'Telegram sign-in required' });
  const video = await AirdropVideo.findOne({ _id: req.body.videoId, active: true });
  if (!video) return res.status(404).json({ error: 'Video not found' });
  try {
    await AirdropVideoClaim.create({ telegramId, videoId: video._id, reward: video.reward });
    const user = await User.findOne({ telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    ensureTransactionArray(user);
    user.balance += video.reward;
    user.transactions.push({ amount: video.reward, type: 'airdrop', status: 'delivered', date: new Date() });
    await user.save();
    res.json({ reward: video.reward, balance: user.balance });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'Reward already claimed' });
    throw error;
  }
});

router.post('/videos/admin/create', (req, res, next) => {
  if (!hasSocialDeveloperAccess(req.auth)) {
    return res.status(403).json({ error: 'Developer access required' });
  }
  next();
}, async (req, res) => {
  const { title, description, videoUrl, thumbnailUrl, platform, reward = 5000 } = req.body;
  if (!title || !videoUrl) return res.status(400).json({ error: 'Title and video URL are required' });
  const video = await AirdropVideo.create({ title, description, videoUrl, thumbnailUrl, platform, reward });
  res.json(video);
});

// ✅ Admin-only middleware

function adminOnly(req, res, next) {

  const auth = req.get('authorization') || '';

  const token = auth.replace(/^Bearer\s+/i, '');

  const list = process.env.AIRDROP_ADMIN_TOKENS;

  if (!list) {

    return res.status(403).json({ error: 'Airdrop admin tokens not configured' });

  }

  const allowed = list.split(',').map(t => t.trim()).filter(Boolean);

  if (!token || !allowed.includes(token)) {

    return res.status(401).json({ error: 'unauthorized' });

  }

  next();

}

// ✅ Admin-only airdrop grant

router.post('/grant', adminOnly, async (req, res) => {

  const { telegramId, amount, reason } = req.body;

  if (!telegramId || typeof amount !== 'number') {

    return res.status(400).json({ error: 'telegramId and amount required' });

  }

  if (amount <= 0) {

    return res.status(400).json({ error: 'amount must be positive' });

  }

  try {

    const user = await User.findOneAndUpdate(

      { telegramId },

      { $setOnInsert: { referralCode: telegramId.toString() } },

      { upsert: true, new: true, setDefaultsOnInsert: true }

    );

    ensureTransactionArray(user);

    user.balance += amount;

    user.transactions.push({

      amount,

      type: 'airdrop',

      status: 'delivered',

      date: new Date()

    });

    await user.save();

    await Airdrop.create({ telegramId, amount, reason });

    try {
      await sendTPCNotification(
        bot,
        telegramId,
        `\u{1FA99} You received an airdrop of ${amount} TPG`
      );
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }

    res.json({ balance: user.balance });

  } catch (err) {

    console.error('Failed to grant airdrop:', err.message);

    res.status(500).json({ error: 'Failed to grant airdrop' });

  }

});

// ✅ Admin-only airdrop to all users
router.post('/grant-all', adminOnly, async (req, res) => {
  const { amount, reason } = req.body;
  if (typeof amount !== 'number') {
    return res.status(400).json({ error: 'amount required' });
  }
  if (amount <= 0) {
    return res.status(400).json({ error: 'amount must be positive' });
  }
  try {
    const users = await User.find();
    let count = 0;
    for (const user of users) {
      ensureTransactionArray(user);
      user.balance += amount;
      user.transactions.push({
        amount,
        type: 'airdrop',
        status: 'delivered',
        date: new Date()
      });
      await user.save();
      await Airdrop.create({ telegramId: user.telegramId, amount, reason });
      if (user.telegramId) {
        try {
          await sendTPCNotification(
            bot,
            user.telegramId,
            `\u{1FA99} You received an airdrop of ${amount} TPG`
          );
        } catch (err) {
          console.error('Failed to send Telegram notification:', err.message);
        }
      }
      count++;
    }
    res.json({ count });
  } catch (err) {
    console.error('Failed to grant airdrop to all:', err.message);
    res.status(500).json({ error: 'Failed to grant airdrop to all users' });
  }
});

export default router;
