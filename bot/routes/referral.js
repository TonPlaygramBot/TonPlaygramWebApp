import { Router } from 'express';
import User from '../models/User.js';
import { ensureTransactionArray } from '../utils/userUtils.js';
import { calculateBoost } from '../utils/miningUtils.js';
import bot from '../bot.js';
import { sendTPCNotification } from '../utils/notifications.js';

const REWARD = 1000;

const router = Router();

router.post('/code', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const count = await User.countDocuments({ referredBy: user.referralCode });
  const storeRate =
    user.storeMiningRate &&
    user.storeMiningExpiresAt &&
    user.storeMiningExpiresAt > new Date()
      ? user.storeMiningRate
      : 0;
  res.json({
    referralCode: user.referralCode,
    referralCount: count,
    bonusMiningRate: calculateBoost(count) + storeRate,
    storeMiningRate: storeRate,
    storeMiningExpiresAt: storeRate ? user.storeMiningExpiresAt : null,
  });
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
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (user.referredBy) {
    return res.json({ message: 'already claimed' });
  }
  if (user.referralCode === code) {
    return res.json({ message: 'cannot claim own code' });
  }

  user.referredBy = code;
  await user.save();

  ensureTransactionArray(user);
  ensureTransactionArray(inviter);

  const txDate = new Date();
  const userTx = {
    amount: REWARD,
    type: 'referral',
    token: 'TPC',
    status: 'delivered',
    date: txDate,
  };
  const inviterTx = { ...userTx };

  user.balance = (user.balance || 0) + REWARD;
  inviter.balance = (inviter.balance || 0) + REWARD;

  user.transactions.push(userTx);
  inviter.transactions.push(inviterTx);

  await user.save();
  await inviter.save();

  if (inviter.telegramId) {
    try {
      await sendTPCNotification(
        bot,
        inviter.telegramId,
        `\u{1FA99} You received ${REWARD} TPC for referring a friend`,
      );
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }
  }

  if (user.telegramId) {
    try {
      await sendTPCNotification(
        bot,
        user.telegramId,
        `\u{1FA99} You received ${REWARD} TPC for joining via referral`,
      );
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }
  }

  const count = await User.countDocuments({ referredBy: code });
  res.json({ message: 'claimed', total: count });
});

router.get('/list/:code', async (req, res) => {
  const { code } = req.params;
  const users = await User.find(
    { referredBy: code },
    'telegramId nickname firstName lastName'
  ).lean();
  res.json(users);
});

export default router;
