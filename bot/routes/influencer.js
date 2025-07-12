import { Router } from 'express';
import InfluencerTask from '../models/InfluencerTask.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { ensureTransactionArray } from '../utils/userUtils.js';
import bot from '../bot.js';

const router = Router();

function calculateReward(views) {
  if (views < 150) return 0;
  if (views < 3000) return 300;
  if (views < 8000) return 900;
  if (views < 15000) return 1800;
  if (views < 30000) return 3500;
  if (views < 100000) return 8000;
  return 20000;
}

// submit influencer video
router.post('/submit', async (req, res) => {
  const { telegramId, videoUrl, platform } = req.body;
  if (!telegramId || !videoUrl || !platform) {
    return res.status(400).json({ error: 'telegramId, videoUrl and platform required' });
  }
  try {
    const task = await InfluencerTask.create({
      userId: String(telegramId),
      videoUrl,
      platform,
    });
    const io = req.app.get('io');
    const sockets = req.app.get('userSockets');
    const devAccount =
      process.env.DEV_ACCOUNT_ID || process.env.VITE_DEV_ACCOUNT_ID;
    if (io && sockets && devAccount) {
      const targets = sockets.get(String(devAccount));
      if (targets) {
        for (const sid of targets) {
          io.to(sid).emit('influencerSubmit', {
            videoUrl,
            platform,
          });
        }
      }
      try {
        const devUser = await User.findOne({ accountId: devAccount });
        if (devUser?.telegramId) {
          await bot.telegram.sendMessage(
            String(devUser.telegramId),
            `New influencer submission: ${videoUrl}`,
          );
          await Message.create({
            from: telegramId,
            to: devUser.telegramId,
            text: `New influencer submission: ${videoUrl}`
          });
        }
      } catch (e) {
        console.error('dev notify failed:', e.message);
      }
    }
    res.json(task);
  } catch (err) {
    console.error('submit influencer failed:', err.message);
    res.status(500).json({ error: 'failed to submit' });
  }
});

// list submissions for user
router.post('/mine', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  try {
    const list = await InfluencerTask.find({ userId: String(telegramId) }).sort({ submittedAt: -1 });
    res.json(list);
  } catch (err) {
    console.error('list influencer tasks failed:', err.message);
    res.status(500).json({ error: 'failed to list' });
  }
});

// admin listing
router.get('/admin', async (req, res) => {
  const auth = req.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const list = process.env.AIRDROP_ADMIN_TOKENS;
  const allowed = list ? list.split(',').map(t => t.trim()).filter(Boolean) : [];
  if (!token || !allowed.includes(token)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const items = await InfluencerTask.find().sort({ submittedAt: -1 });
    res.json(items);
  } catch (err) {
    console.error('admin influencer list failed:', err.message);
    res.status(500).json({ error: 'failed to list' });
  }
});

// admin verify
router.patch('/admin/:id/verify', async (req, res) => {
  const auth = req.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const list = process.env.AIRDROP_ADMIN_TOKENS;
  const allowed = list ? list.split(',').map(t => t.trim()).filter(Boolean) : [];
  if (!token || !allowed.includes(token)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const { id } = req.params;
  const { views = 0, status } = req.body || {};
  if (!id || !['approved','rejected'].includes(status)) {
    return res.status(400).json({ error: 'invalid parameters' });
  }
  try {
    const task = await InfluencerTask.findById(id);
    if (!task) return res.status(404).json({ error: 'not found' });
    task.views = views;
    task.status = status;
    task.verified = status === 'approved';
    if (status === 'approved') {
      task.rewardTPC = calculateReward(views);
      const user = await User.findOneAndUpdate(
        { telegramId: Number(task.userId) },
        { $setOnInsert: { referralCode: String(task.userId) } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      ensureTransactionArray(user);
      user.minedTPC += task.rewardTPC;
      user.transactions.push({
        amount: task.rewardTPC,
        type: 'influencer',
        status: 'pending',
        date: new Date()
      });
      await user.save();
    } else {
      task.rewardTPC = 0;
    }
    await task.save();
    res.json(task);
  } catch (err) {
    console.error('verify influencer failed:', err.message);
    res.status(500).json({ error: 'failed to verify' });
  }
});

export default router;
