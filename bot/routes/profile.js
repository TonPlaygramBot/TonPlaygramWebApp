import { Router } from 'express';
import passport from 'passport';
import User from '../models/User.js';

const router = Router();

router.post('/get', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true }
  );
  res.json(user);
});

router.post('/update', async (req, res) => {
  const { telegramId, nickname, photo, bio } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const update = {};
  if (nickname !== undefined) update.nickname = nickname;
  if (photo !== undefined) update.photo = photo;
  if (bio !== undefined) update.bio = bio;

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $set: update, $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true }
  );
  res.json(user);
});

router.post('/updateBalance', async (req, res) => {
  const { telegramId, balance } = req.body;
  if (!telegramId || balance === undefined) {
    return res.status(400).json({ error: 'telegramId and balance required' });
  }
  const user = await User.findOneAndUpdate(
    { telegramId },
    { $set: { balance }, $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true }
  );
  res.json({ balance: user.balance });
});

router.post('/addTransaction', async (req, res) => {
  const { telegramId, amount, type } = req.body;
  if (!telegramId || amount === undefined || !type) {
    return res.status(400).json({ error: 'telegramId, amount and type required' });
  }
  const user = await User.findOneAndUpdate(
    { telegramId },
    {
      $push: { transactions: { amount, type, date: new Date() } },
      $setOnInsert: { referralCode: telegramId.toString() }
    },
    { upsert: true, new: true }
  );
  res.json({ transactions: user.transactions });
});

router.post('/link-social', async (req, res) => {
  const { telegramId, twitter, telegramHandle, discord, googleId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const update = {};
  if (twitter !== undefined) update['social.twitter'] = twitter;
  if (telegramHandle !== undefined) update['social.telegram'] = telegramHandle;
  if (discord !== undefined) update['social.discord'] = discord;
  if (googleId !== undefined) update['social.googleId'] = googleId;

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $set: update, $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true }
  );
  res.json({ social: user.social });
});

router.get('/google', passport.authenticate('google', { scope: ['profile'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    res.json({ message: 'google linked', user: req.user });
  }
);

export default router;
