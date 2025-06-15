import { Router } from 'express';
import User from '../models/User.js';
import Airdrop from '../models/Airdrop.js';
import { ensureTransactionArray } from '../utils/userUtils.js';

const router = Router();

// Grant an airdrop to a user
router.post('/grant', async (req, res) => {
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
      { upsert: true, new: true }
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

    res.json({ balance: user.balance });
  } catch (err) {
    console.error('Failed to grant airdrop:', err.message);
    res.status(500).json({ error: 'Failed to grant airdrop' });
  }
});

export default router;
