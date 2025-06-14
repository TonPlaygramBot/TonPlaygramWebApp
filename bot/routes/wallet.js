import { Router } from 'express';
import User from '../models/User.js';

const router = Router();

router.post('/balance', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) {
    return res.status(400).json({ error: 'telegramId required' });
  }
  const user = await User.findOne({ telegramId });
  res.json({ balance: user ? user.balance : 0 });
});

// Fetch TON balance from the blockchain using a public API
router.post('/ton-balance', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'address required' });
  }
  try {
    const resp = await fetch(
      `https://toncenter.com/api/v2/getAddressBalance?address=${address}`
    );
    const data = await resp.json();
    if (!data.ok) {
      return res.status(400).json({ error: data.error || 'failed to fetch' });
    }
    const balance = Number(data.result) / 1e9; // nanotons -> TON
    res.json({ balance });
  } catch (err) {
    console.error('Error fetching TON balance:', err);
    res.status(500).json({ error: 'Failed to fetch TON balance' });
  }
});

// Transfer TPC from one Telegram user to another
router.post('/send', async (req, res) => {
  const { fromId, toId, amount } = req.body;
  if (!fromId || !toId || typeof amount !== 'number') {
    return res.status(400).json({ error: 'fromId, toId and amount required' });
  }
  if (amount <= 0) {
    return res.status(400).json({ error: 'amount must be positive' });
  }

  const sender = await User.findOne({ telegramId: fromId });
  if (!sender || sender.balance < amount) {
    return res.status(400).json({ error: 'insufficient balance' });
  }

  sender.balance -= amount;
  await sender.save();

  await User.findOneAndUpdate(
    { telegramId: toId },
    { $inc: { balance: amount }, $setOnInsert: { referralCode: toId.toString() } },
    { upsert: true }
  );

  await User.updateOne(
    { telegramId: fromId },
    { $push: { transactions: { amount: -amount, type: 'send', date: new Date() } } }
  );
  await User.updateOne(
    { telegramId: toId },
    { $push: { transactions: { amount, type: 'receive', date: new Date() } } }
  );

  res.json({ balance: sender.balance });
});

export default router;
