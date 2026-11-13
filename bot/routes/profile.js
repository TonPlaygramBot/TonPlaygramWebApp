import { Router } from 'express';
import User from '../models/User.js';
import { fetchTelegramInfo } from '../utils/telegram.js';
import { sanitizeUser } from '../utils/userUtils.js';
import { verifyGoogleIdToken } from '../utils/googleAuth.js';
import { sanitizePublicPhoto } from '../utils/publicPhoto.js';
import authenticate, { optionalAuthenticate } from '../middleware/auth.js';

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
    return false;
  }

  if (reqAuth?.accountId && user.accountId) {
    return String(reqAuth.accountId) === String(user.accountId);
  }

  if (reqAuth?.googleId && user.googleId) {
    return String(reqAuth.googleId) === String(user.googleId);
  }

  return false;
}

// These legacy registration routes accepted public identifiers as ownership.
// Account creation now belongs to /api/account/create with verified login or a
// newly issued guest session; wallet ownership needs a separate proof flow.
router.post('/register-wallet', (_req, res) => {
  res.status(410).json({ error: 'wallet_proof_required' });
});

router.post('/register-google', (_req, res) => {
  res.status(410).json({ error: 'use_verified_account_login' });
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
    res.json({ ...info, photoUrl: sanitizePublicPhoto(info.photoUrl) });
  } catch (err) {
    console.error('Error fetching telegram info:', err);
    res.status(500).json({ error: 'failed to fetch telegram info' });
  }
});

router.post('/get', optionalAuthenticate, async (req, res) => {
  const { telegramId, accountId } = req.body;
  if ((!Number.isSafeInteger(telegramId) || telegramId <= 0) &&
      (typeof accountId !== 'string' || !accountId.trim())) {
    return res.status(400).json({ error: 'telegramId or accountId required' });
  }

  try {
    // Public profile reads never create accounts, refresh identity, or repair
    // balances. A caller knowing an account number only sees public fields.
    const user = await User.findOne(
      typeof accountId === 'string' && accountId.trim() ? { accountId } : { telegramId }
    );
    if (!user) return res.status(404).json({ error: 'account not found' });

    if (canManageUserTransactions(req.auth, user)) {
      return res.json({ ...sanitizeUser(user), filledFromTelegram: false });
    }

    return res.json({
      accountId: user.accountId,
      tpcAccountNumber: user.tpcAccountNumber || user.accountId,
      nickname: user.nickname,
      firstName: user.firstName,
      lastName: user.lastName,
      photo: sanitizePublicPhoto(user.photo),
      bio: user.bio,
      social: user.social,
      filledFromTelegram: false
    });
  } catch (err) {
    console.error('Failed to read profile:', err.message);
    return res.status(500).json({ error: 'failed to read profile' });
  }
});

router.post('/by-account', async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });
  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
  const { telegramId, nickname, firstName, lastName, photo } = user;
  res.json({ accountId: user.accountId, telegramId, nickname, firstName, lastName, photo: sanitizePublicPhoto(photo) });
});

router.post('/update', authenticate, async (req, res) => {
  const { telegramId, nickname, photo, bio, firstName, lastName } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!req.auth?.telegramId || req.auth.telegramId !== telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const update = {};
  if (nickname !== undefined) update.nickname = nickname;
  if (photo !== undefined) { update.photo = sanitizePublicPhoto(photo); update.photoCustom = true; }
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

// Client-reported balances and ledger entries cannot establish payment or
// game settlement. These routes intentionally fail closed, including API-token
// callers, until migrated to an authoritative, idempotent settlement service.
function rejectClientAccounting(_req, res) {
  return res.status(403).json({ error: 'server_settlement_required' });
}
router.post('/updateBalance', authenticate, rejectClientAccounting);
router.post('/addTransaction', authenticate, rejectClientAccounting);

router.post('/link-google', authenticate, async (req, res) => {
  const { telegramId, googleCredential } = req.body;
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0 ||
      typeof googleCredential !== 'string' || !googleCredential) {
    return res.status(400).json({ error: 'telegramId and googleCredential required' });
  }
  if (req.auth?.telegramId !== telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  try {
    const identity = await verifyGoogleIdToken(googleCredential);
    if (!identity) return res.status(401).json({ error: 'invalid_google_credential' });

    const [existing, googleOwner] = await Promise.all([
      User.findOne({ telegramId }),
      User.findOne({ googleId: identity.googleId })
    ]);
    if (!existing) return res.status(404).json({ error: 'account not found' });
    if ((existing.googleId && existing.googleId !== identity.googleId) ||
        (googleOwner && String(googleOwner._id) !== String(existing._id))) {
      return res.status(409).json({ error: 'google_account_already_linked' });
    }

    const update = {
      googleId: identity.googleId,
      googleEmail: identity.email,
      firstName: identity.firstName,
      lastName: identity.lastName
    };
    if (!existing.photoCustom) update.photo = sanitizePublicPhoto(identity.photo);

    // Guard against a concurrent relink of this Telegram account. The unique
    // Google identity index prevents the same Google login claiming two users.
    const user = await User.findOneAndUpdate(
      {
        _id: existing._id,
        $or: [{ googleId: { $exists: false } }, { googleId: null },
          { googleId: '' }, { googleId: identity.googleId }]
      },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(409).json({ error: 'google_account_already_linked' });
    return res.json(sanitizeUser(user));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'google_account_already_linked' });
    }
    console.error('Failed to link Google account:', err.message);
    return res.status(503).json({ error: 'google_link_unavailable' });
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
