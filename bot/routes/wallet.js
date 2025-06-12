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

export default router;
