import { Router } from 'express';
import User from '../models/User.js';
import { ensureTransactionArray } from '../utils/userUtils.js';

const router = Router();
const REWARD = 100;
const LIMIT = 10;

function resetCounter(user) {
  const now = new Date();
  if (
    !user.lastAdReset ||
    now.getUTCFullYear() !== user.lastAdReset.getUTCFullYear() ||
    now.getUTCMonth() !== user.lastAdReset.getUTCMonth() ||
    now.getUTCDate() !== user.lastAdReset.getUTCDate()
  ) {
    user.adsWatchedToday = 0;
    user.lastAdReset = now;
  }
}

router.post('/watch', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true }
  );
  ensureTransactionArray(user);
  resetCounter(user);

  if (user.adsWatchedToday >= LIMIT) {
    return res.status(400).json({ error: 'daily limit reached' });
  }

  user.adsWatchedToday += 1;
  user.minedTPC += REWARD;
  user.transactions.push({
    amount: REWARD,
    type: 'ad',
    status: 'pending',
    date: new Date()
  });
  await user.save();

  res.json({ reward: REWARD, count: user.adsWatchedToday, remaining: LIMIT - user.adsWatchedToday });
});

router.post('/status', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const user = await User.findOne({ telegramId });
  let count = 0;
  if (user) {
    resetCounter(user);
    await user.save();
    count = user.adsWatchedToday || 0;
  }
  res.json({ count, remaining: LIMIT - count });
});

export default router;
