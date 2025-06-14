import { Router } from 'express';
import User from '../models/User.js';

const REFERRAL_REWARD = 5000;

const router = Router();

router.post('/code', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true }
  );

  const count = await User.countDocuments({ referredBy: user.referralCode });
  res.json({ code: user.referralCode, referrals: count });
});

router.post('/claim', async (req, res) => {
  const { telegramId, code } = req.body;
  if (!telegramId || !code) {
    return res.status(400).json({ error: 'telegramId and code required' });
  }

  const inviter = await User.findOne({ referralCode: code });
  if (!inviter) return res.status(400).json({ error: 'invalid code' });

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true }
  );

  if (user.referredBy) {
    return res.json({ message: 'already claimed' });
  }
  if (user.referralCode === code) {
    return res.json({ message: 'cannot claim own code' });
  }

  user.referredBy = code;

  inviter.balance += REFERRAL_REWARD;
  inviter.transactions.push({
    amount: REFERRAL_REWARD,
    type: 'referral',
    status: 'delivered',
    date: new Date()
  });
  await inviter.save();

  user.balance += REFERRAL_REWARD;
  user.transactions.push({
    amount: REFERRAL_REWARD,
    type: 'referral',
    status: 'delivered',
    date: new Date()
  });
  await user.save();

  const count = await User.countDocuments({ referredBy: code });
  res.json({ message: 'claimed', total: count, reward: REFERRAL_REWARD });
});

export default router;
