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
