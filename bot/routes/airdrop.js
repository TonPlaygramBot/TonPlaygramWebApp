import { Router } from 'express';

import User from '../models/User.js';

import Airdrop from '../models/Airdrop.js';

import { ensureTransactionArray } from '../utils/userUtils.js';
import bot from '../bot.js';
import { sendTPCNotification } from '../utils/notifications.js';

const router = Router();

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
        `\u{1FA99} You received an airdrop of ${amount} TPC`
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
            `\u{1FA99} You received an airdrop of ${amount} TPC`
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
