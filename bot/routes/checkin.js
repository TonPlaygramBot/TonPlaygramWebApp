import { Router } from 'express';
import User from '../models/User.js';
import { ensureTransactionArray } from '../utils/userUtils.js';

const REWARDS = Array.from({ length: 30 }, (_, i) => 100 + i * 20);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const router = Router();

// Perform daily check-in and award mining credits
router.post('/check-in', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  try {
    const user = await User.findOneAndUpdate(
      { telegramId },
      { $setOnInsert: { referralCode: telegramId.toString() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    ensureTransactionArray(user);

    const now = Date.now();

    if (user.lastCheckIn && now - user.lastCheckIn.getTime() < ONE_DAY_MS) {
      return res.status(400).json({ error: 'already checked in' });
    }

    let streak = 1;
    if (user.lastCheckIn && now - user.lastCheckIn.getTime() < ONE_DAY_MS * 2) {
      streak = user.dailyStreak + 1;
    }
    if (streak > REWARDS.length) {
      return res.status(400).json({ error: 'max days reached' });
    }
    const reward = REWARDS[streak - 1];

    user.lastCheckIn = new Date(now);
    user.dailyStreak = streak;
    user.balance += reward;
    user.transactions.push({
      amount: reward,
      type: 'daily',
      status: 'delivered',
      date: new Date(now)
    });
    await user.save();

    res.json({ streak, reward, balance: user.balance });
  } catch (err) {
    console.error('Daily check-in failed:', err.message);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

export default router;
