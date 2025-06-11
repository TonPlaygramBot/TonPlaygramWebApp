import { Router } from 'express';
import User from '../models/User.js';

const router = Router();

// Get referral code and friend list
router.post('/info', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true }
  );

  const referrals = await User.countDocuments({ referredBy: user.referralCode });
  res.json({ code: user.referralCode, friends: user.friends || [], referrals });
});

// Add a friend by telegram id
router.post('/add', async (req, res) => {
  const { telegramId, friendId } = req.body;
  if (!telegramId || !friendId) {
    return res.status(400).json({ error: 'telegramId and friendId required' });
  }

  if (telegramId === friendId) {
    return res.status(400).json({ error: 'cannot friend yourself' });
  }

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true }
  );

  const friend = await User.findOneAndUpdate(
    { telegramId: friendId },
    { $setOnInsert: { referralCode: friendId.toString() } },
    { upsert: true, new: true }
  );

  if (user.friends?.includes(friendId)) {
    return res.json({ message: 'already friends' });
  }

  user.friends = [...(user.friends || []), friendId];
  await user.save();
  res.json({ message: 'friend added', friends: user.friends });
});

export default router;
