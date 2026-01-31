import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import { fetchTelegramInfo } from '../utils/telegram.js';
import { ensureTransactionArray, calculateBalance, sanitizeUser } from '../utils/userUtils.js';
import { normalizeAddress } from '../utils/ton.js';
import authenticate, { requireApiToken } from '../middleware/auth.js';

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

function getOwnerToken(req) {
  return req.get('x-account-owner-token') || req.body?.ownerToken || '';
}

function canAccessProfile(req, user) {
  if (!user) return false;
  if (req.auth?.apiToken) return true;
  if (user.telegramId) {
    return req.auth?.telegramId === user.telegramId;
  }
  return user.ownerToken && getOwnerToken(req) === user.ownerToken;
}

router.post('/register-wallet', authenticate, async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ error: 'walletAddress required' });
  }
  if (!req.auth?.apiToken && !req.auth?.telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const normalized = normalizeAddress(walletAddress);
  if (!normalized) {
    return res.status(400).json({ error: 'invalid walletAddress' });
  }
  const query = req.auth?.telegramId
    ? { telegramId: req.auth.telegramId }
    : { walletAddress: normalized };
  const update = req.auth?.telegramId
    ? {
      $set: { walletAddress: normalized },
      $setOnInsert: { referralCode: String(req.auth.telegramId) }
    }
    : { $setOnInsert: { walletAddress: normalized, referralCode: normalized } };
  const user = await User.findOneAndUpdate(query, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true
  });
  res.json(sanitizeUser(user));
});

router.post('/register-google', authenticate, requireApiToken, async (req, res) => {
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

router.post('/get', authenticate, async (req, res) => {
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

  const isOwner = canAccessProfile(req, user);

  if (isOwner) {
    return res.json({ ...sanitizeUser(user), filledFromTelegram });
  }

  if (!user.telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  return res.json({
    accountId: user.accountId,
    nickname: user.nickname,
    firstName: user.firstName,
    lastName: user.lastName,
    photo: user.photo,
    bio: user.bio,
    social: user.social,
    filledFromTelegram
  });
});

router.post('/by-account', async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });
  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
  const { nickname, firstName, lastName, photo } = user;
  res.json({ nickname, firstName, lastName, photo });
});

router.post('/update', authenticate, async (req, res) => {
  const { telegramId, nickname, photo, bio, firstName, lastName } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!req.auth?.telegramId || req.auth.telegramId !== telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }

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

router.post('/updateBalance', authenticate, requireApiToken, async (req, res) => {
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

router.post('/addTransaction', authenticate, requireApiToken, async (req, res) => {
  const { telegramId, accountId, amount, type, game, players } = req.body;
  if ((telegramId == null && !accountId) || amount === undefined || !type) {
    return res
      .status(400)
      .json({ error: 'telegramId or accountId, amount and type required' });
  }
  let user = null;
  if (telegramId != null) {
    user = await User.findOne({ telegramId });
  }
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

router.post('/link-google', authenticate, async (req, res) => {
  const { telegramId, googleId, email, dob, firstName, lastName, photo } = req.body;
  if (!telegramId || !googleId) {
    return res.status(400).json({ error: 'telegramId and googleId required' });
  }
  if (!req.auth?.telegramId || req.auth.telegramId !== telegramId) {
    return res.status(403).json({ error: 'forbidden' });
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

router.post('/link-social', authenticate, async (req, res) => {
  const { telegramId, twitter, telegramHandle, discord } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!req.auth?.telegramId || req.auth.telegramId !== telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }

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
