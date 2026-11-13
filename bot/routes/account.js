import { sanitizePublicPhoto } from '../utils/publicPhoto.js';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import authenticate from '../middleware/auth.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { createAuthSession } from '../utils/authSession.js';
import { verifyGoogleIdToken } from '../utils/googleAuth.js';
import {
  ensureTransactionArray,
  calculateBalance,
  resolveAccountBalance
} from '../utils/userUtils.js';
import bot from '../bot.js';
import {
  sendGiftNotification,
  sendStorePurchaseNotification
} from '../utils/notifications.js';
import NFT_GIFTS from '../utils/nftGifts.js';

import { mintGiftNFT } from '../utils/nftService.js';
import { generateWalletAddress } from '../utils/wallet.js';
import { fetchTelegramInfo } from '../utils/telegram.js';
import { applyStoreItemDelivery } from './store.js';
import { sendWalletTransfer } from './wallet.js';
import { POOL_ROYALE_STORE_ITEMS } from '../../webapp/src/config/poolRoyaleInventoryConfig.js';
import { SNOOKER_ROYALE_STORE_ITEMS } from '../../webapp/src/config/snookerRoyalInventoryConfig.js';

import {
  createMemoryUser,
  findMemoryUser,
  saveMemoryUser,
  shouldUseMemoryUserStore
} from '../utils/memoryUserStore.js';

const router = Router();

const STORE_ITEMS_INDEX = new Map(
  [
    ...POOL_ROYALE_STORE_ITEMS,
    ...SNOOKER_ROYALE_STORE_ITEMS,

  ].map((item) => [
    `${item.type}:${item.optionId}`,
    item
  ])
);

export function resolveStoreItemPreview(items = []) {
  for (const item of items) {
    const key = `${item.type}:${item.optionId}`;
    const found = STORE_ITEMS_INDEX.get(key);
    if (found) {
      return {
        thumbnail: found.thumbnail,
        label: found.label || `${item.type} • ${item.optionId}`
      };
    }
  }

  const first = items[0];
  if (!first) return { thumbnail: null, label: 'Store item' };
  return {
    thumbnail: null,
    label: `${first.type || 'item'} • ${first.optionId || first.slug || 'default'}`
  };
}

function requireVerifiedSettlement(_req, res) {
  return res.status(403).json({ error: 'verified_settlement_required' });
}

function isPrivileged(req) {
  return req.auth?.apiToken === true;
}

function canAccessUser(req, user) {
  if (isPrivileged(req)) return true;
  if (!user) return false;
  if (user.telegramId && req.auth?.telegramId && user.telegramId === req.auth.telegramId) return true;
  if (user.googleId && req.auth?.googleId && user.googleId === req.auth.googleId) return true;
  if (user.accountId && req.auth?.accountId && user.accountId === req.auth.accountId) return true;
  return false;
}

// Identifiers select accounts; only verified provider proof or a signed session
// authorizes access. In particular, a public account number is never a login.
router.post('/create', optionalAuthenticate, async (req, res) => {
  const body = req.body || {};
  const useMemoryStore = shouldUseMemoryUserStore();
  try {
    let googleProfile = null;
    if (body.googleCredential) {
      googleProfile = await verifyGoogleIdToken(body.googleCredential);
      if (!googleProfile) return res.status(401).json({ error: 'invalid_google_credential' });
    }
    const telegramId = googleProfile ? undefined : isPrivileged(req)
      ? body.telegramId
      : req.auth?.telegramId;
    const googleId = googleProfile?.googleId || (!telegramId ? req.auth?.googleId : undefined);
    if (body.telegramId && Number(body.telegramId) !== telegramId) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (body.googleId && body.googleId !== googleId) {
      return res.status(403).json({ error: 'verified_google_sign_in_required' });
    }
    if (telegramId != null && (!Number.isSafeInteger(telegramId) || telegramId <= 0)) {
      return res.status(400).json({ error: 'invalid_telegram_id' });
    }
    if (body.walletAddress) {
      return res.status(403).json({ error: 'wallet_ownership_proof_required' });
    }

    const findUser = async (query) =>
      useMemoryStore ? findMemoryUser(query) : User.findOne(query);
    const persistUser = async (user) =>
      useMemoryStore ? saveMemoryUser(user) : user.save();
    // A fresh provider login resolves that provider's account. Never merge it
    // into a caller-selected account, even when that account has no provider.
    const selector = telegramId ? { telegramId }
      : googleId ? { googleId }
        : req.auth?.accountId ? { accountId: req.auth.accountId } : null;
    let user = selector ? await findUser(selector) : null;
    if (body.accountId && body.accountId !== user?.accountId) {
      return res.status(req.auth || googleProfile ? 403 : 401).json({ error: 'account_sign_in_required' });
    }
    if (user?.isBanned) return res.status(403).json({ error: 'account_banned' });
    if (req.auth?.accountId && !telegramId && !googleId && !user) {
      return res.status(401).json({ error: 'account_sign_in_required' });
    }

    const id = user?.accountId || uuidv4();
    // Check signing configuration before creating an account. Return only
    // verified identities in the token; Google display data is not a proof.
    const sessionToken = createAuthSession({
      accountId: id,
      ...(user?.telegramId ? { telegramId: user.telegramId } : !user && telegramId ? { telegramId } : {}),
      ...(user?.googleId ? { googleId: user.googleId } : !user && googleId ? { googleId } : {})
    });
    if (!user) {
      const wallet = await generateWalletAddress();
      let telegramProfile = null;
      if (telegramId) {
        try { telegramProfile = await fetchTelegramInfo(telegramId); }
        catch (err) { console.error('fetchTelegramInfo failed:', err.message); }
      }
      const data = {
        accountId: id,
        ...(telegramId ? { telegramId } : {}),
        ...(googleId ? { googleId } : {}),
        referralCode: String(telegramId || googleId || id),
        walletAddress: wallet.address,
        walletPublicKey: wallet.publicKey,
        firstName: googleProfile?.firstName || telegramProfile?.firstName || '',
        lastName: googleProfile?.lastName || telegramProfile?.lastName || '',
        photo: googleProfile?.photo || telegramProfile?.photoUrl || '',
        googleEmail: googleProfile?.email || ''
      };
      user = useMemoryStore ? createMemoryUser(data) : new User(data);
      if (!useMemoryStore) await user.save();
    } else if (googleProfile) {
      user.googleEmail = googleProfile.email;
      user.firstName = googleProfile.firstName;
      user.lastName = googleProfile.lastName;
      if (!user.photoCustom) user.photo = googleProfile.photo;
      await persistUser(user);
    }
    res.set('Cache-Control', 'no-store');
    res.json({
      accountId: user.accountId,
      sessionToken,
      balance: resolveAccountBalance(user),
      walletAddress: user.walletAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      photo: sanitizePublicPhoto(user.photo),
      profile: {
        accountId: user.accountId,
        telegramId: user.telegramId,
        googleId: user.googleId,
        nickname: user.nickname,
        firstName: user.firstName,
        lastName: user.lastName,
        photo: sanitizePublicPhoto(user.photo),
        balance: resolveAccountBalance(user),
        gifts: Array.isArray(user.gifts) ? user.gifts : [],
        transactions: Array.isArray(user.transactions) ? user.transactions : [],
        social: user.social || {}
      }
    });
  } catch (err) {
    console.error('Failed to create account:', err.message);
    res.status(503).json({ error: 'account_sign_in_unavailable' });
  }
});

// Get balance by account id
router.post('/balance', authenticate, async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });

  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
  if (!canAccessUser(req, user)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const balance = resolveAccountBalance(user);
  res.json({ balance });
});

// Get full account info including gifts and transactions
router.post('/info', authenticate, async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });

  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
  if (!canAccessUser(req, user)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  ensureTransactionArray(user);
  if (!Array.isArray(user.gifts)) user.gifts = [];

  const balance = resolveAccountBalance(user);

  res.json({
    accountId: user.accountId,
    telegramId: user.telegramId,
    nickname: user.nickname,
    firstName: user.firstName,
    lastName: user.lastName,
    photo: sanitizePublicPhoto(user.photo),
    balance,
    gifts: user.gifts,
    transactions: user.transactions
  });
});

// Keep the old URL as an adapter to the same atomic/idempotent transfer.
// Fee distribution must also be transactional before fees can be reintroduced.
router.post('/send', authenticate, (req, res) => {
  const { fromAccount, toAccount, ...rest } = req.body || {};
  req.body = { ...rest, fromAccountId: fromAccount, toAccountId: toAccount };
  return sendWalletTransfer(req, res);
});

// Send a gift using account ids
router.post('/gift', authenticate, requireVerifiedSettlement, async (req, res) => {
  const { fromAccount, toAccount, gift } = req.body;
  if (!fromAccount || !toAccount || !gift) {
    return res
      .status(400)
      .json({ error: 'fromAccount, toAccount and gift required' });
  }

  const g = NFT_GIFTS.find((x) => x.id === gift);
  if (!g) return res.status(400).json({ error: 'invalid gift' });

  const sender = await User.findOne({ accountId: fromAccount });
  if (!sender || sender.balance < g.price) {
    return res.status(400).json({ error: 'insufficient balance' });
  }
  if (!canAccessUser(req, sender)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  let receiver = await User.findOne({ accountId: toAccount });
  if (!receiver) receiver = new User({ accountId: toAccount });

  ensureTransactionArray(sender);
  ensureTransactionArray(receiver);
  if (!Array.isArray(receiver.gifts)) receiver.gifts = [];

  let nftTokenId;
  try {
    nftTokenId = await mintGiftNFT(g.id, receiver.walletAddress);
  } catch (err) {
    console.error('Failed to mint gift NFT:', err.message);
    return res.status(500).json({ error: 'failed to mint NFT' });
  }

  sender.balance -= g.price;

  const txDate = new Date();
  const senderTx = {
    amount: -g.price,
    type: 'gift',
    token: 'TPG',
    status: 'delivered',
    date: txDate,
    toAccount: String(toAccount),
    detail: gift,
    category: String(g.tier)
  };
  sender.transactions.push(senderTx);

  const giftEntry = {
    _id: uuidv4(),
    gift: g.id,
    price: g.price,
    tier: g.tier,
    fromAccount: String(fromAccount),
    fromName: sender.nickname || sender.firstName || '',
    date: txDate,
    nftTokenId
  };
  receiver.gifts.push(giftEntry);

  const receiverTx = {
    amount: 0,
    type: 'gift-receive',
    token: 'TPG',
    status: 'pending',
    date: txDate,
    fromAccount: String(fromAccount),
    fromName: sender.nickname || sender.firstName || '',
    giftId: giftEntry._id,
    detail: gift,
    category: String(g.tier)
  };
  receiver.transactions.push(receiverTx);

  await sender.save();
  await receiver.save();

  if (receiver.telegramId) {
    try {
      await sendGiftNotification(
        bot,
        receiver.telegramId,
        g,
        sender.nickname || sender.firstName || String(fromAccount),
        txDate,
        { senderPhoto: sender.photo }
      );
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }
  }

  res.json({ balance: sender.balance, transaction: senderTx });
});

router.post('/store-purchase', authenticate, requireVerifiedSettlement, async (req, res) => {
  const { accountId, fromAccount, bundle, txHash } = req.body;
  const purchaserAccountId = String(accountId || fromAccount || '').trim();

  if (!purchaserAccountId) {
    return res.status(400).json({ error: 'accountId required' });
  }

  if (txHash) {
    return res.status(400).json({ error: 'TON payments are disabled. Use TPG balance only.' });
  }

  const isItemBundle =
    bundle &&
    typeof bundle === 'object' &&
    !Array.isArray(bundle) &&
    Array.isArray(bundle.items);

  if (!isItemBundle) {
    return res.status(400).json({ error: 'items bundle required' });
  }

  const sender = await User.findOne({ accountId: purchaserAccountId });
  if (!sender) return res.status(404).json({ error: 'account not found' });
  if (!canAccessUser(req, sender)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const rawItems = bundle.items.filter(Boolean);
  if (!rawItems.length) {
    return res.status(400).json({ error: 'items required' });
  }

  const items = rawItems.map((item) => ({
    slug: item.slug,
    type: item.type,
    optionId: item.optionId,
    price: Number(item.price) || 0
  }));

  const totalPrice = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  if (!Number.isFinite(totalPrice) || totalPrice < 0) {
    return res.status(400).json({ error: 'invalid bundle total' });
  }

  if (sender.balance < totalPrice) {
    return res.status(400).json({ error: 'insufficient balance' });
  }

  ensureTransactionArray(sender);

  const txDate = new Date();

  const delivery = applyStoreItemDelivery(sender, items);

  sender.balance -= totalPrice;
  sender.transactions.push({
    amount: -totalPrice,
    type: 'storefront',
    token: 'TPG',
    status: 'delivered',
    date: txDate,
    detail: 'Store purchase',
    items: items.map((item) => JSON.stringify(item))
  });

  await sender.save();

  if (sender.telegramId) {
    const preview = resolveStoreItemPreview(items);
    const itemCount = items.length;
    const itemLabel =
      itemCount > 1
        ? `${preview.label} +${itemCount - 1} more`
        : preview.label;

    sendStorePurchaseNotification(bot, sender.telegramId, {
      totalPrice,
      date: txDate,
      thumbnail: preview.thumbnail,
      itemLabel
    }).catch((err) => {
      console.error('Failed to send Telegram store receipt:', err.message);
    });
  }

  return res.json({
    balance: sender.balance,
    transaction: sender.transactions[sender.transactions.length - 1],
    paymentToken: 'TPG',
    delivery: {
      pool: delivery.pool.length,
      snooker: delivery.snooker.length,
      unsupported: delivery.unsupported.length
    }
  });
});

// Convert received gifts to TPG
router.post('/convert-gifts', authenticate, requireVerifiedSettlement, async (req, res) => {
  const { accountId, giftIds, action = 'burn', toAccount } = req.body;
  if (!accountId || !Array.isArray(giftIds)) {
    return res.status(400).json({ error: 'accountId and giftIds required' });
  }

  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
  if (!canAccessUser(req, user)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  ensureTransactionArray(user);
  if (!Array.isArray(user.gifts)) user.gifts = [];

  const selected = user.gifts.filter((g) => giftIds.includes(g._id));
  if (selected.length === 0) {
    return res.json({ balance: user.balance, gifts: user.gifts });
  }

  const txDate = new Date();

  if (action === 'transfer') {
    if (!toAccount) {
      return res.status(400).json({ error: 'toAccount required for transfer' });
    }
    let receiver = await User.findOne({ accountId: toAccount });
    if (!receiver) receiver = new User({ accountId: toAccount });

    ensureTransactionArray(receiver);
    if (!Array.isArray(receiver.gifts)) receiver.gifts = [];

    for (const g of selected) {
      const pendingIndex = user.transactions.findIndex(
        (t) =>
          t.giftId === g._id &&
          t.type === 'gift-receive' &&
          t.status === 'pending'
      );
      if (pendingIndex !== -1) {
        user.transactions.splice(pendingIndex, 1);
      }

      const entry = {
        _id: g._id,
        gift: g.gift,
        price: g.price,
        tier: g.tier,
        fromAccount: String(user.accountId),
        fromName: user.nickname || user.firstName || '',
        date: txDate
      };
      receiver.gifts.push(entry);

      receiver.transactions.push({
        amount: 0,
        type: 'gift-receive',
        token: 'TPG',
        status: 'pending',
        date: txDate,
        fromAccount: String(user.accountId),
        fromName: user.nickname || user.firstName || '',
        giftId: entry._id,
        detail: g.gift,
        category: String(g.tier)
      });

      user.transactions.push({
        amount: 0,
        type: 'gift-transfer',
        token: 'TPG',
        status: 'delivered',
        date: txDate,
        toAccount: String(toAccount),
        toName: receiver.nickname || receiver.firstName || '',
        giftId: entry._id,
        detail: g.gift,
        category: String(g.tier)
      });
    }

    user.gifts = user.gifts.filter((g) => !giftIds.includes(g._id));
    await user.save();
    await receiver.save();

    return res.json({ balance: user.balance, gifts: user.gifts });
  } else {
    for (const g of selected) {
      const pendingIndex = user.transactions.findIndex(
        (t) =>
          t.giftId === g._id &&
          t.type === 'gift-receive' &&
          t.status === 'pending'
      );
      if (pendingIndex !== -1) {
        user.transactions.splice(pendingIndex, 1);
      }
      const fee = Math.round(g.price * 0.1);
      const net = g.price - fee;
      user.transactions.push({
        amount: net,
        type: 'gift-receive',
        token: 'TPG',
        status: 'delivered',
        date: txDate,
        fromAccount: g.fromAccount,
        fromName: g.fromName,
        detail: g.gift,
        category: String(g.tier),
        giftId: g._id
      });
      user.transactions.push({
        amount: -fee,
        type: 'gift-fee',
        token: 'TPG',
        status: 'delivered',
        date: txDate,
        detail: g.gift
      });
    }

    user.gifts = user.gifts.filter((g) => !giftIds.includes(g._id));
    user.balance = calculateBalance(user);
    await user.save();

    return res.json({ balance: user.balance, gifts: user.gifts });
  }
});

// List transactions by account id
router.post('/transactions', authenticate, async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });
  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
  if (!canAccessUser(req, user)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  ensureTransactionArray(user);
  res.json({ transactions: user.transactions });
});

// List all public game-related transactions
router.get('/transactions/public', async (req, res) => {
  const limitParam = Number(req.query.limit) || 100;
  const limit = Math.min(Math.max(limitParam, 1), 1000);
  const transactions = await User.aggregate([
    { $unwind: '$transactions' },
    { $match: { 'transactions.game': { $exists: true } } },
    {
      $project: {
        _id: 0,
        accountId: '$accountId',
        amount: '$transactions.amount',
        type: '$transactions.type',
        game: '$transactions.game',
        date: '$transactions.date',
        token: '$transactions.token',
        fromAccount: { $ifNull: ['$transactions.fromAccount', '$accountId'] },
        fromName: {
          $ifNull: [
            '$transactions.fromName',
            { $ifNull: ['$nickname', '$firstName'] }
          ]
        },
        fromPhoto: { $ifNull: ['$transactions.fromPhoto', '$photo'] }
      }
    },
    { $sort: { date: -1 } },
    { $limit: limit }
  ]);
  res.json({ transactions });
});

// List all public wallet transfers between users
router.get('/transfers/public', async (req, res) => {
  const limitParam = Number(req.query.limit) || 100;
  const limit = Math.min(Math.max(limitParam, 1), 1000);
  const transferMatch = {
    'transactions.type': 'send',
    'transactions.toAccount': { $exists: true, $ne: '' },
    'transactions.amount': { $lt: 0 }
  };
  const [transactions, totalResult] = await Promise.all([
    User.aggregate([
      { $unwind: '$transactions' },
      { $match: transferMatch },
      {
        $project: {
          _id: 0,
          amount: { $abs: '$transactions.amount' },
          token: { $ifNull: ['$transactions.token', 'TPG'] },
          date: '$transactions.date',
          note: '$transactions.detail',
          fromAccount: '$accountId',
          fromName: { $ifNull: ['$nickname', '$firstName'] },
          fromPhoto: '$photo',
          toAccount: '$transactions.toAccount',
          toName: '$transactions.toName'
        }
      },
      { $sort: { date: -1 } },
      { $limit: limit }
    ]),
    User.aggregate([
      { $unwind: '$transactions' },
      { $match: transferMatch },
      { $count: 'totalCount' }
    ])
  ]);

  const totalCount = totalResult[0]?.totalCount || 0;

  res.json({ transactions, totalCount });
});

// Client-reported winnings or requested amounts are not payment/reward proofs.
// Credits must be introduced by an authoritative, idempotent settlement service.
router.post('/deposit', authenticate, (_req, res) => {
  res.status(403).json({ error: 'verified_settlement_required' });
});

export default router;
