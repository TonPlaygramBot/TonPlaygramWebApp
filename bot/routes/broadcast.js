import { Router } from 'express';
import bot from '../bot.js';
import User from '../models/User.js';

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

router.post('/send', adminOnly, async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const users = await User.find().select('telegramId');
    let count = 0;
    for (const user of users) {
      if (!user.telegramId) continue;
      try {
        await bot.telegram.sendMessage(String(user.telegramId), text);
        count++;
      } catch (err) {
        console.error('Failed to send message to', user.telegramId, err.message);
      }
    }
    res.json({ count });
  } catch (err) {
    console.error('Broadcast failed:', err.message);
    res.status(500).json({ error: 'failed to send broadcast' });
  }
});

export default router;
