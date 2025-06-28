import { Router } from 'express';

import User from '../models/User.js';

import Airdrop from '../models/Airdrop.js';

import { ensureTransactionArray } from '../utils/userUtils.js';

const router = Router();

const DEV_ACCOUNT_ID = process.env.DEV_ACCOUNT_ID ||
  '5ffe7c43-c0ae-48f6-ab8c-9e065ca95466';

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

// Check if a user claimed the welcome airdrop
router.post('/status', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) {
    return res.status(400).json({ error: 'telegramId required' });
  }
  const claimed = await Airdrop.findOne({ telegramId, reason: 'welcome' });
  res.json({ claimed: !!claimed });
});

// Claim welcome airdrop funded by the dev account
router.post('/claim-welcome', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) {
    return res.status(400).json({ error: 'telegramId required' });
  }
  const existing = await Airdrop.findOne({ telegramId, reason: 'welcome' });
  if (existing) {
    return res.status(400).json({ error: 'already claimed' });
  }
  try {
    let user = await User.findOneAndUpdate(
      { telegramId },
      { $setOnInsert: { referralCode: telegramId.toString() } },
      { upsert: true, new: true }
    );
    ensureTransactionArray(user);

    const dev = await User.findOne({ accountId: DEV_ACCOUNT_ID });
    if (!dev || dev.balance < 10000) {
      return res.status(400).json({ error: 'airdrop unavailable' });
    }
    ensureTransactionArray(dev);

    const txDate = new Date();
    user.balance += 10000;
    dev.balance -= 10000;
    const userTx = { amount: 10000, type: 'airdrop', status: 'delivered', date: txDate };
    const devTx = { amount: -10000, type: 'airdrop', status: 'delivered', date: txDate };
    user.transactions.push(userTx);
    dev.transactions.push(devTx);
    await user.save();
    await dev.save();
    await Airdrop.create({ telegramId, amount: 10000, reason: 'welcome' });
    res.json({ balance: user.balance });
  } catch (err) {
    console.error('Failed to claim airdrop:', err.message);
    res.status(500).json({ error: 'failed to claim' });
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
      count++;
    }
    res.json({ count });
  } catch (err) {
    console.error('Failed to grant airdrop to all:', err.message);
    res.status(500).json({ error: 'Failed to grant airdrop to all users' });
  }
});

export default router;
