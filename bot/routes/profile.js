import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import { fetchTelegramInfo } from '../utils/telegram.js';
import { ensureTransactionArray, calculateBalance, sanitizeUser } from '../utils/userUtils.js';
import { normalizeAddress } from '../utils/ton.js';

export function parseTwitterHandle(input) {
  if (!input) return '';
  let handle = String(input).trim();
  // Support handles like "x.com/user" without protocol
  if (/^(?:x|twitter)\.com\//.test(handle)) {
    handle = 'https://' + handle;
  }
  // Remove URL parts if a full profile link was provided
  try {
    const url = new URL(handle);
    handle = url.pathname.replace(/^\//, '');
  } catch {
    // not a URL
  }
  // Drop query or trailing segments
  handle = handle.split(/[/?]/)[0];
  // Strip leading @ if present
  handle = handle.replace(/^@/, '');
  return handle;
}

const router = Router();

router.get('/google-client-id', (req, res) => {
  const clientId =
    process.env.WEBAPP_GOOGLE_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    '';

  if (!clientId) {
    return res.status(404).json({ error: 'google client id not configured' });
  }

  res.json({ clientId });
});

router.post('/register-wallet', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ error: 'walletAddress required' });
  }
  const normalized = normalizeAddress(walletAddress);
  if (!normalized) {
    return res.status(400).json({ error: 'invalid walletAddress' });
  }
  const user = await User.findOneAndUpdate(
    { walletAddress: normalized },
    { $setOnInsert: { walletAddress: normalized, referralCode: normalized } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json(sanitizeUser(user));
});

router.post('/register-google', async (req, res) => {
  const { googleId } = req.body;
  if (!googleId) {
    return res.status(400).json({ error: 'googleId required' });
  }
  const user = await User.findOneAndUpdate(
    { googleId },
    { $setOnInsert: { googleId, referralCode: googleId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json(sanitizeUser(user));
});

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
  const { telegramId, accountId } = req.body;
  if (!telegramId && !accountId) {
    return res.status(400).json({ error: 'telegramId or accountId required' });
  }

  let user = null;
  if (accountId) user = await User.findOne({ accountId });
  if (!user && telegramId) user = await User.findOne({ telegramId });

  let filledFromTelegram = false;
  if (!user || !user.firstName || !user.lastName || !user.photo) {
    let info = null;
    const tgId = telegramId || user?.telegramId;
    if (tgId) info = await fetchTelegramInfo(tgId);

    const update = {
      $setOnInsert: { referralCode: String(tgId || accountId) }
    };
    if (info) {
      update.$set = {
        firstName: info.firstName,
        lastName: info.lastName,
        photo: info.photoUrl
      };
      filledFromTelegram = true;
    }

    user = await User.findOneAndUpdate(
      accountId ? { accountId } : { telegramId: tgId },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  if (!user.accountId) {
    user.accountId = uuidv4();
    await user.save();
  }


  ensureTransactionArray(user);
  if (!Array.isArray(user.gifts)) user.gifts = [];
  const balance = calculateBalance(user);
  if (user.balance !== balance) {
    user.balance = balance;
    await user.save();
  }

  res.json({ ...sanitizeUser(user), filledFromTelegram });
});

router.post('/by-account', async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });
  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
  const { nickname, firstName, lastName, photo } = user;
  res.json({ nickname, firstName, lastName, photo });
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
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json(sanitizeUser(user));
});

router.post('/updateBalance', async (req, res) => {
  const { telegramId, balance } = req.body;
  if (!telegramId || balance === undefined) {
    return res.status(400).json({ error: 'telegramId and balance required' });
  }
  const user = await User.findOneAndUpdate(
    { telegramId },
    { $set: { balance }, $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json({ balance: user.balance });
});

router.post('/addTransaction', async (req, res) => {
  const { telegramId, accountId, amount, type, game, players } = req.body;
  if ((telegramId == null && !accountId) || amount === undefined || !type) {
    return res
      .status(400)
      .json({ error: 'telegramId or accountId, amount and type required' });
  }
  let user = null;
  if (telegramId != null) user = await User.findOne({ telegramId });
  if (!user && accountId) user = await User.findOne({ accountId });
  if (!user) {
    const data = {
      accountId,
      referralCode: String(telegramId || accountId)
    };
    if (telegramId != null) data.telegramId = telegramId;
    user = new User(data);
  }
  ensureTransactionArray(user);
  const tx = { amount, type, date: new Date() };
  if (game) tx.game = game;
  if (players) tx.players = players;
  user.transactions.push(tx);
  await user.save();
  res.json({ transactions: user.transactions });
});

router.post('/link-google', async (req, res) => {
  const { telegramId, googleId, email, dob, firstName, lastName, photo } = req.body;
  if (!telegramId || !googleId) {
    return res.status(400).json({ error: 'telegramId and googleId required' });
  }

  const update = {
    googleId,
    googleEmail: email,
    googleDob: dob
  };

  if (firstName !== undefined) update.firstName = firstName;
  if (lastName !== undefined) update.lastName = lastName;
  if (photo !== undefined) update.photo = photo;

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $set: update, $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json(sanitizeUser(user));
});

router.post('/link-social', async (req, res) => {
  const { telegramId, twitter, telegramHandle, discord } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const update = {};
  if (twitter !== undefined) update['social.twitter'] = parseTwitterHandle(twitter);
  if (telegramHandle !== undefined) update['social.telegram'] = telegramHandle;
  if (discord !== undefined) update['social.discord'] = discord;

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $set: update, $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json({ social: user.social });
});

export default router;
