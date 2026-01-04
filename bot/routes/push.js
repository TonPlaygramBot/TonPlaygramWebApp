import { Router } from 'express';
import User from '../models/User.js';

const router = Router();

function normalizePlatform(platform) {
  if (!platform) return 'unknown';
  const value = String(platform).toLowerCase();
  if (['ios', 'android', 'web'].includes(value)) return value;
  return value;
}

router.post('/register', async (req, res) => {
  const { token, platform, accountId, telegramId } = req.body || {};
  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'token required' });
  }

  try {
    const selector = accountId ? { accountId } : telegramId != null ? { telegramId } : null;
    const user = selector ? await User.findOne(selector) : null;
    if (!user) {
      return res.json({ success: true, registered: false });
    }

    const normalizedToken = token.trim();
    const entries = Array.isArray(user.pushTokens) ? user.pushTokens : [];
    const withoutDuplicates = entries.filter((entry) => entry?.token !== normalizedToken);
    withoutDuplicates.unshift({
      token: normalizedToken,
      platform: normalizePlatform(platform),
      updatedAt: new Date()
    });
    user.pushTokens = withoutDuplicates.slice(0, 5);
    await user.save();

    res.json({ success: true, registered: true });
  } catch (err) {
    console.error('Failed to register push token', err);
    res.status(500).json({ error: 'failed to register token' });
  }
});

export default router;
