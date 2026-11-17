import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import { reconcileBalanceSnapshot } from '../utils/reconcileBalance.js';
import { fetchTelegramInfo } from '../utils/telegram.js';
import { ensureTransactionArray, sanitizeUser } from '../utils/userUtils.js';
import { normalizeAddress } from '../utils/ton.js';
import authenticate from '../middleware/auth.js';
import { verifyRequestedIdentity, sendIdentityError } from '../middleware/accountIdentity.js';

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

export function canManageUserTransactions(reqAuth = {}, user = null, requestedTelegramId = null) {
  if (!user) return false;
  if (reqAuth?.apiToken) return true;

  const authTelegramId = reqAuth?.telegramId;
  if (authTelegramId != null) {
    if (requestedTelegramId != null && Number(requestedTelegramId) !== Number(authTelegramId)) {
      return false;
    }
    if (user.telegramId != null) {
      return Number(user.telegramId) === Number(authTelegramId);
    }
    return requestedTelegramId != null;
  }

  if (reqAuth?.accountId && user.accountId) {
    return String(reqAuth.accountId) === String(user.accountId);
  }

  if (reqAuth?.googleId && user.googleId) {
    return String(reqAuth.googleId) === String(user.googleId);
  }

  return false;
}

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
  if (!googleId) return res.status(400).json({ error: 'googleId required' });
  try { await verifyRequestedIdentity(req, { googleId }); }
  catch (error) { return sendIdentityError(res, error); }
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
        photo: user?.photoCustom ? user.photo : info.photoUrl
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
  }
  if (!user.tpcAccountNumber) {
    user.tpcAccountNumber = String(user.accountId);
  }
  await user.save();


  try { user = await reconcileBalanceSnapshot(user); }
  catch (error) { return res.status(503).json({ error: 'balance_temporarily_unavailable' }); }
  if (!user) return res.status(404).json({ error: 'account not found' });
  ensureTransactionArray(user);
  if (!Array.isArray(user.gifts)) user.gifts = [];

  const isOwner =
    req.auth?.telegramId &&
    user?.telegramId &&
    req.auth.telegramId === user.telegramId;

  if (isOwner) {
    return res.json({ ...sanitizeUser(user), filledFromTelegram });
  }

  return res.json({
    accountId: user.accountId,
    tpcAccountNumber: user.tpcAccountNumber || user.accountId,
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
  const { telegramId, nickname, firstName, lastName, photo } = user;
  res.json({ accountId: user.accountId, telegramId, nickname, firstName, lastName, photo });
});

router.post('/update', authenticate, async (req, res) => {
  const { telegramId, nickname, photo, bio, firstName, lastName } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!req.auth?.telegramId || req.auth.telegramId !== telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const update = {};
  if (nickname !== undefined) update.nickname = nickname;
  if (photo !== undefined) { update.photo = photo; update.photoCustom = true; }
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

router.post('/updateBalance', authenticate, async (req, res) => {
  const { telegramId, balance } = req.body;
  if (!telegramId || balance === undefined) {
    return res.status(400).json({ error: 'telegramId and balance required' });
  }
  if (!req.auth?.telegramId || req.auth.telegramId !== telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const user = await User.findOneAndUpdate(
    { telegramId },
    { $set: { balance }, $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json({ balance: user.balance });
});

router.post('/addTransaction', authenticate, async (req, res) => {
  const { telegramId, accountId, amount, type, game, players } = req.body;
  // Compatibility identity headers cannot create or claim a sign-in mapping.
  if (!req.auth?.apiToken) {
    try { req.auth = await verifyRequestedIdentity(req, { telegramId }); }
    catch (error) { return sendIdentityError(res, error); }
  }
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
      accountId: accountId || uuidv4(),
      referralCode: String(telegramId || accountId)
    };
    if (telegramId != null) data.telegramId = telegramId;
    if (req.auth?.googleId) data.googleId = req.auth.googleId;
    user = new User(data);
  }

  if (!canManageUserTransactions(req.auth, user, telegramId)) {
    return res.status(403).json({ error: 'forbidden' });
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
  const { telegramId, googleId, email, dob, firstName, lastName, photo } = req.body || {};
  if (!telegramId || !googleId) return res.status(400).json({ error: 'telegramId and googleId required' });
  // Linking proves ownership of both sign-ins. Knowing a Google subject id or
  // presenting somebody else's account-id header is not authorization.
  try { await verifyRequestedIdentity(req, { telegramId, googleId }); }
  catch (error) { return sendIdentityError(res, error); }
  try {
    const [existing, googleOwner] = await Promise.all([
      User.findOne({ telegramId }), User.findOne({ googleId })
    ]);
    if (!existing || existing.isBanned) return res.status(404).json({ error: 'account_not_found' });
    if (googleOwner && String(googleOwner._id) !== String(existing._id)) {
      return res.status(409).json({ error: 'identity_already_linked', message: 'This Google sign-in belongs to another account.' });
    }
    const update = { googleId, googleEmail: String(email || '').slice(0, 254) };
    if (typeof dob === 'string') update.googleDob = dob.slice(0, 20);
    if (typeof firstName === 'string') update.firstName = firstName.slice(0, 100);
    if (typeof lastName === 'string') update.lastName = lastName.slice(0, 100);
    if (typeof photo === 'string' && !existing.photoCustom) update.photo = photo.slice(0, 2048);
    const user = await User.findOneAndUpdate(
      { _id: existing._id, telegramId }, { $set: update }, { new: true }
    );
    if (!user) return res.status(409).json({ error: 'account_changed' });
    res.setHeader('Cache-Control', 'no-store');
    res.json(sanitizeUser(user));
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'identity_already_linked' });
    res.status(500).json({ error: 'link_failed' });
  }
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

router.post('/delete', authenticate, async (req, res) => {
  const { accountId, confirmation } = req.body || {};
  if (!accountId || confirmation !== 'DELETE') {
    return res.status(400).json({ error: 'accountId and DELETE confirmation required' });
  }

  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });

  // Account-id and Google-id headers are compatibility identifiers, not proof
  // of identity. Destructive deletion requires signed Telegram init data or a
  // trusted server-to-server credential until native Google token verification
  // is implemented.
  const ownsTelegramAccount =
    req.auth?.telegramId != null &&
    user.telegramId != null &&
    Number(req.auth.telegramId) === Number(user.telegramId);
  if (!req.auth?.apiToken && !ownsTelegramAccount) {
    return res.status(403).json({
      error: 'reauthentication_required',
      message: 'Open TonPlaygram from the linked Telegram account, or contact privacy@tonplaygram.com.'
    });
  }

  const pendingFinancialActivity = (user.transactions || []).some(
    (transaction) => transaction?.status === 'pending'
  );
  if (pendingFinancialActivity || user.currentTableId) {
    return res.status(409).json({
      error: 'account_has_pending_activity',
      message: 'Finish or request support for pending games and transactions before deletion.'
    });
  }

  await User.deleteOne({ _id: user._id });
  return res.json({ success: true, deletedAccountId: String(accountId) });
});

export default router;
