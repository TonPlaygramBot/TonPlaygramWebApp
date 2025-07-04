import { Router } from 'express';
import bot from '../bot.js';
import User from '../models/User.js';
import authenticate from '../middleware/auth.js';

const router = Router();

async function adminOnly(req, res, next) {
  const auth = req.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const list = process.env.AIRDROP_ADMIN_TOKENS;
  const allowed = list ? list.split(',').map(t => t.trim()).filter(Boolean) : [];

  const devAccounts = [
    process.env.DEV_ACCOUNT_ID || process.env.VITE_DEV_ACCOUNT_ID,
    process.env.DEV_ACCOUNT_ID_1 || process.env.VITE_DEV_ACCOUNT_ID_1,
    process.env.DEV_ACCOUNT_ID_2 || process.env.VITE_DEV_ACCOUNT_ID_2,
  ].filter(Boolean);

  let isDev = false;
  if (req.auth?.telegramId) {
    const u = await User.findOne({ telegramId: req.auth.telegramId });
    if (u && devAccounts.includes(u.accountId)) isDev = true;
  }

  if (token && allowed.includes(token)) return next();
  if (isDev) return next();

  if (!list && !isDev) {
    return res.status(403).json({ error: 'Airdrop admin tokens not configured' });
  }
  res.status(401).json({ error: 'unauthorized' });
}

router.post('/send', authenticate, adminOnly, async (req, res) => {
  const { text, photo } = req.body || {};
  if (!text && !photo) {
    return res.status(400).json({ error: 'text or photo required' });
  }
  try {
    const users = await User.find().select('telegramId');
    let count = 0;
    let image;
    if (photo) {
      const base = photo.replace(/^data:image\/\w+;base64,/, '');
      image = Buffer.from(base, 'base64');
    }
    for (const user of users) {
      if (!user.telegramId) continue;
      try {
        if (image) {
          await bot.telegram.sendPhoto(
            String(user.telegramId),
            { source: image },
            text ? { caption: text } : undefined
          );
        } else {
          await bot.telegram.sendMessage(String(user.telegramId), text);
        }
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
