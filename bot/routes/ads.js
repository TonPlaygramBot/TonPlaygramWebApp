import { Router } from 'express';
import AdView from '../models/AdView.js';
import User from '../models/User.js';
import { ensureTransactionArray } from '../utils/userUtils.js';

const router = Router();
const DAILY_LIMIT = 10;
const REWARD = 100;

function startOfToday() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

router.post('/status', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const count = await AdView.countDocuments({
    telegramId,
    viewedAt: { $gte: startOfToday() }
  });

  res.json({ count, remaining: Math.max(DAILY_LIMIT - count, 0) });
});

router.post('/watch', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const today = startOfToday();
  const count = await AdView.countDocuments({ telegramId, viewedAt: { $gte: today } });
  if (count >= DAILY_LIMIT) {
    return res.status(400).json({ error: 'limit reached' });
  }

  await AdView.create({ telegramId });
  const user = await User.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  ensureTransactionArray(user);
  user.minedTPC += REWARD;
  user.transactions.push({
    amount: REWARD,
    type: 'ad',
    status: 'pending',
    date: new Date()
  });
  await user.save();

  res.json({ message: 'watched', reward: REWARD, remaining: DAILY_LIMIT - count - 1 });
});

export default router;
