import { Router } from 'express';
import passport from 'passport';
import User from '../models/User.js';
import { fetchTelegramInfo } from '../utils/telegram.js';

const router = Router();

router.post('/telegram-info', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) {
    return res.status(400).json({ error: 'telegramId required' });
  }
  try {
    const info = await fetchTelegramInfo(telegramId);
    if (!info) {
      return res.status(503).json({ error: 'failed to fetch telegram info' });
    }
    res.json(info);
  } catch (err) {
    console.error('Error fetching telegram info:', err);
    res.status(500).json({ error: 'failed to fetch telegram info' });
  }
});

router.post('/get', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  const info = await fetchTelegramInfo(telegramId);

  const update = { $setOnInsert: { referralCode: telegramId.toString() } };
  if (info) {
    update.$set = {
      firstName: info.firstName,
      lastName: info.lastName,
      photo: info.photoUrl
    };
  }

  const user = await User.findOneAndUpdate(
    { telegramId },
    update,
    { upsert: true, new: true }
  );
  res.json(user);
});

router.post('/update', async (req, res) => {
  const { telegramId, nickname, photo, bio, firstName, lastName } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const update = {};
  if (nickname !== undefined) update.nickname = nickname;
  if (photo !== undefined) update.photo = photo;
  if (bio !== undefined) update.bio = bio;
  if (firstName !== undefined) update.firstName = firstName;
  if (lastName !== undefined) update.lastName = lastName;

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

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get('/google', passport.authenticate('google', { scope: ['profile'] }));

  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false }),
    (req, res) => {
      res.json({ message: 'google linked', user: req.user });
    }
  );
}

export default router;
