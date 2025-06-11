import { Router } from 'express';
import User from '../models/User.js';

const router = Router();

router.post('/balance', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) {
    return res.status(400).json({ error: 'telegramId required' });
  }
  const user = await User.findOne({ telegramId });
  const address = user?.walletAddress;
  if (!address) return res.json({ balance: 0 });
  try {
    const url = `https://toncenter.com/api/v2/getAddressInformation?address=${address}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const nano = parseInt(data.result?.balance || '0', 10);
    const balance = nano / 1e9;
    res.json({ balance });
  } catch (err) {
    console.error('Failed to fetch TON balance:', err.message);
    res.status(500).json({ error: 'failed to fetch balance' });
  }
});

router.post('/address', async (req, res) => {
  const { telegramId, address } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (address) {
    const user = await User.findOneAndUpdate(
      { telegramId },
      {
        $set: { walletAddress: address },
        $setOnInsert: { referralCode: telegramId.toString() }
      },
      { upsert: true, new: true }
    );
    return res.json({ address: user.walletAddress });
  }
  const user = await User.findOne({ telegramId });
  res.json({ address: user ? user.walletAddress : null });
});

router.post('/address', async (req, res) => {
  const { telegramId, address } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (address) {
    const user = await User.findOneAndUpdate(
      { telegramId },
      {
        $set: { walletAddress: address },
        $setOnInsert: { referralCode: telegramId.toString() }
      },
      { upsert: true, new: true }
    );
    return res.json({ address: user.walletAddress });
  }
  const user = await User.findOne({ telegramId });
  res.json({ address: user ? user.walletAddress : null });
});

export default router;
