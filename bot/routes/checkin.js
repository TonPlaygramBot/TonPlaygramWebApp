import { Router } from 'express';
import User from '../models/User.js';
import { authenticateRewardAccount } from '../middleware/rewardGuard.js';

const REWARDS = Array.from({ length: 30 }, (_, i) => 100 + i * 20);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const router = Router();

// The eligibility check and balance/ledger write share one conditional update.
// Concurrent requests cannot award the same check-in twice or overwrite a spend.
router.post('/check-in', ...authenticateRewardAccount, async (req, res) => {
  const { telegramId } = req.body;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) return res.status(404).json({ error: 'account not found' });
    if (user.isBanned) return res.status(403).json({ error: 'forbidden' });
    const now = new Date();
    const previousCheckIn = user.lastCheckIn || null;
    const elapsed = previousCheckIn ? now.getTime() - previousCheckIn.getTime() : Infinity;
    if (elapsed < ONE_DAY_MS) {
      return res.status(400).json({ error: 'already checked in' });
    }
    const streak = elapsed < ONE_DAY_MS * 2 ? (user.dailyStreak || 0) + 1 : 1;
    if (!Number.isSafeInteger(streak) || streak < 1 || streak > REWARDS.length) {
      return res.status(400).json({ error: 'max days reached' });
    }
    const reward = REWARDS[streak - 1];
    const updated = await User.findOneAndUpdate(
      { _id: user._id, lastCheckIn: previousCheckIn, isBanned: { $ne: true } },
      {
        $set: { lastCheckIn: now, dailyStreak: streak },
        $inc: { balance: reward },
        $push: {
          transactions: {
            amount: reward,
            type: 'daily',
            status: 'delivered',
            date: now,
            transactionId: `checkin:${user.accountId}:${now.toISOString()}`
          }
        }
      },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(409).json({ error: 'check-in already processed' });
    res.json({ streak, reward, balance: updated.balance });
  } catch (err) {
    console.error('Daily check-in failed:', err.message);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

export default router;
