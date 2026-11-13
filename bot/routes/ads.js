import { Router } from 'express';
import AdView from '../models/AdView.js';
import User from '../models/User.js';
import { ensureTransactionArray } from '../utils/userUtils.js';

const router = Router();
const DAILY_LIMIT = 5;
const REWARD = 50;
const HOURLY_REWARD = 200;
const HOUR_MS = 60 * 60 * 1000;

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
    type: 'daily',
    viewedAt: { $gte: startOfToday() }
  });

  res.json({ count, remaining: Math.max(DAILY_LIMIT - count, 0) });
});

router.post('/watch', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const today = startOfToday();
  const count = await AdView.countDocuments({ telegramId, type: 'daily', viewedAt: { $gte: today } });
  if (count >= DAILY_LIMIT) {
    return res.status(400).json({ error: 'limit reached' });
  }

  await AdView.create({ telegramId, type: 'daily' });
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

router.post('/quest-status', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const last = await AdView.findOne({ telegramId, type: 'quest' }).sort({ viewedAt: -1 });
  const ts = last ? last.viewedAt.getTime() : 0;
  const remaining = HOUR_MS - (Date.now() - ts);
  res.json({ remaining: remaining > 0 ? remaining : 0 });
});

router.post('/quest-watch', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const last = await AdView.findOne({ telegramId, type: 'quest' }).sort({ viewedAt: -1 });
  if (last && Date.now() - last.viewedAt.getTime() < HOUR_MS) {
    return res.status(400).json({ error: 'not ready' });
  }

  await AdView.create({ telegramId, type: 'quest' });
  const user = await User.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  ensureTransactionArray(user);
  user.balance += HOURLY_REWARD;
  user.transactions.push({
    amount: HOURLY_REWARD,
    type: 'quest',
    status: 'delivered',
    date: new Date()
  });
  await user.save();

  res.json({ reward: HOURLY_REWARD });
});

export default router;
