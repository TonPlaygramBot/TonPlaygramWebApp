import { Router } from 'express';
import User from '../models/User.js';
import Airdrop from '../models/Airdrop.js';
import { ensureTransactionArray } from '../utils/userUtils.js';

const router = Router();

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

// Grant an airdrop to a user (admin only)
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
