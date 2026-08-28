import { Router } from 'express';
import User from '../models/User.js';
import authenticate from '../middleware/auth.js';

const router = Router();

function normalizePlatform(platform) {
  if (!platform) return 'unknown';
  const value = String(platform).toLowerCase();
  if (['ios', 'android', 'web'].includes(value)) return value;
  return value;
}

export function pushTokenOwnerSelector(auth = {}) {
  if (auth.apiToken) return null;
  if (auth.accountId) return { accountId: auth.accountId };
  if (auth.telegramId != null) return { telegramId: auth.telegramId };
  if (auth.googleId) return { googleId: auth.googleId };
  return null;
}

router.post('/register', authenticate, async (req, res) => {
  const { token, platform, accountId, telegramId, googleId } = req.body || {};
  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'token required' });
  }

  try {
    const selector = req.auth?.apiToken
      ? accountId
        ? { accountId }
        : telegramId != null
          ? { telegramId }
          : googleId
            ? { googleId }
            : null
      : pushTokenOwnerSelector(req.auth);
    if (!selector) {
      return res.status(403).json({ error: 'authenticated account required' });
    }
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
