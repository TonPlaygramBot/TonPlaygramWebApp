import authenticate from './auth.js';
import User from '../models/User.js';

// Telegram IDs in request bodies are selectors, never proof of ownership.
export async function requireRewardAccountOwner(req, res, next) {
  const telegramId = req.body?.telegramId;
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
    return res.status(400).json({ error: 'valid telegramId required' });
  }
  if (req.auth?.telegramId === telegramId) return next();
  if (req.auth?.telegramId || !req.auth?.accountId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const user = await User.findOne({ accountId: req.auth.accountId });
    if (!user || user.isBanned || user.telegramId !== telegramId) {
      return res.status(403).json({ error: 'forbidden' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

export const authenticateRewardAccount = [authenticate, requireRewardAccountOwner];

// Legacy handlers below this guard cannot establish a paid-ad view, ownership
// of external social activity, or exactly-once settlement. Keep them closed,
// including to administrators, until a verified, idempotent award service exists.
// A runtime environment flag must not bypass the settlement requirement.
export function requireVerifiedReward(_req, res) {
  return res.status(403).json({
    error: 'Rewards are unavailable until verified settlement is enabled.',
    code: 'reward_verification_required'
  });
}
