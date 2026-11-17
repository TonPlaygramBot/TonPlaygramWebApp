import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import { verifyTelegramInitData } from '../middleware/auth.js';

const REWARDS = Array.from({ length: 30 }, (_, i) => 100 + i * 20);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Only this reward writer is hardened. Legacy writers/read repair elsewhere can
// still change this wallet; this endpoint does not certify historical funds.
export function createCheckinRouter({ UserModel = User, now = () => Date.now() } = {}) {
  const router = Router();
  router.post('/check-in', async (req, res) => {
    const { telegramId } = req.body || {};
    if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
      return res.status(400).json({ error: 'telegramId required' });
    }
    const timestamp = now();
    const verified = verifyTelegramInitData(req.get('x-telegram-init-data'), process.env.BOT_TOKEN, { now: timestamp });
    if (!verified) return res.status(401).json({ error: 'Open TonPlayGram from Telegram again to claim your daily reward.' });
    if (JSON.parse(verified.user).id !== telegramId) return res.status(403).json({ error: 'forbidden' });
    try {
      // Retain first-use creation for signed Telegram clients. The unique
      // telegramId index arbitrates concurrent initial requests.
      try {
        const accountId = randomUUID();
        await UserModel.updateOne({ telegramId }, { $setOnInsert: { referralCode: String(telegramId), accountId, tpcAccountNumber: accountId } }, { upsert: true, setDefaultsOnInsert: true });
      } catch (error) { if (error.code !== 11000) throw error; }
      for (let attempt = 0; attempt < 4; attempt++) {
        const user = await UserModel.findOne({ telegramId }).lean();
        if (!user || user.isBanned) return res.status(403).json({ error: 'forbidden' });
        const last = user.lastCheckIn == null ? null : new Date(user.lastCheckIn).getTime();
        if ((last !== null && !Number.isFinite(last)) || !Number.isSafeInteger(user.dailyStreak) || user.dailyStreak < 0 ||
            !Number.isSafeInteger(user.balance) || user.balance < 0 || !Array.isArray(user.transactions)) {
          return res.status(409).json({ error: 'Wallet needs review before claiming. Your balance has not been changed.' });
        }
        if (last !== null && timestamp - last < ONE_DAY_MS) return res.status(400).json({ error: 'already checked in' });
        const streak = last !== null && timestamp - last < ONE_DAY_MS * 2 ? user.dailyStreak + 1 : 1;
        if (streak > REWARDS.length) return res.status(400).json({ error: 'max days reached' });
        const reward = REWARDS[streak - 1];
        if (!Number.isSafeInteger(user.balance + reward)) return res.status(409).json({ error: 'Wallet needs review before claiming. Your balance has not been changed.' });
        // A single document update couples entitlement, credit, and receipt.
        // CAS includes the balance so a concurrent value change is revalidated.
        const updated = await UserModel.findOneAndUpdate({
          _id: user._id, telegramId, isBanned: { $ne: true }, balance: user.balance,
          dailyStreak: user.dailyStreak, lastCheckIn: user.lastCheckIn ?? null
        }, {
          $inc: { balance: reward },
          $set: { lastCheckIn: new Date(timestamp), dailyStreak: streak },
          $push: { transactions: { transactionId: `checkin:${user._id}:${timestamp}`, amount: reward,
            type: 'daily', token: 'TPG', status: 'delivered', date: new Date(timestamp) } }
        }, { new: true });
        if (updated) return res.json({ streak, reward, balance: updated.balance });
      }
      return res.status(409).json({ error: 'Wallet changed while claiming. Please retry.' });
    } catch (err) {
      console.error('Daily check-in failed:', err.message);
      return res.status(500).json({ error: 'Failed to check in' });
    }
  });
  return router;
}
export default createCheckinRouter();
