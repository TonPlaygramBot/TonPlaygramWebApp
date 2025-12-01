import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import authenticate from '../middleware/auth.js';
import {
  ensureTransactionArray,
  calculateBalance
} from '../utils/userUtils.js';
import bot from '../bot.js';
import {
  sendTransferNotification,
  sendTPCNotification,
  sendGiftNotification
} from '../utils/notifications.js';
import NFT_GIFTS from '../utils/nftGifts.js';

import { mintGiftNFT } from '../utils/nftService.js';
import { generateWalletAddress } from '../utils/wallet.js';
import { fetchTelegramInfo } from '../utils/telegram.js';

const router = Router();

// Create or fetch account for a user
router.post('/create', async (req, res) => {
  const { telegramId, googleId } = req.body;

  try {
    let user;
    let telegramProfile = null;

    if (telegramId) {
      try {
        telegramProfile = await fetchTelegramInfo(telegramId);
      } catch (err) {
        console.error('fetchTelegramInfo failed:', err);
      }

      user = await User.findOne({ telegramId });
      if (!user) {
        const wallet = await generateWalletAddress();
        const baseData = {
          telegramId,
          accountId: uuidv4(),
          referralCode: String(telegramId),
          walletAddress: wallet.address,
          walletPublicKey: wallet.publicKey
        };

        if (telegramProfile) {
          baseData.firstName = telegramProfile.firstName || '';
          baseData.lastName = telegramProfile.lastName || '';
          baseData.photo = telegramProfile.photoUrl || '';
        }

        user = new User(baseData);
        await user.save();
      } else {
        let updated = false;
        if (!user.accountId) {
          user.accountId = uuidv4();
          updated = true;
        }
        if (!user.walletAddress) {
          const wallet = await generateWalletAddress();
          user.walletAddress = wallet.address;
          user.walletPublicKey = wallet.publicKey;
          updated = true;
        }
        if (telegramProfile) {
          if (!user.firstName && telegramProfile.firstName) {
            user.firstName = telegramProfile.firstName;
            updated = true;
          }
          if (!user.lastName && telegramProfile.lastName) {
            user.lastName = telegramProfile.lastName;
            updated = true;
          }
          if (!user.photo && telegramProfile.photoUrl) {
            user.photo = telegramProfile.photoUrl;
            updated = true;
          }
        }
        if (updated) await user.save();
      }
    } else if (googleId) {
      user = await User.findOne({ googleId });
      if (!user) {
        const wallet = await generateWalletAddress();
        user = new User({
          googleId,
          accountId: uuidv4(),
          referralCode: googleId,
          walletAddress: wallet.address,
          walletPublicKey: wallet.publicKey
        });
        await user.save();
      } else {
        let updated = false;
        if (!user.accountId) {
          user.accountId = uuidv4();
          updated = true;
        }
        if (!user.walletAddress) {
          const wallet = await generateWalletAddress();
          user.walletAddress = wallet.address;
          user.walletPublicKey = wallet.publicKey;
          updated = true;
        }
        if (updated) await user.save();
      }
    } else {
      const wallet = await generateWalletAddress();
      const id = uuidv4();
      user = new User({
        accountId: id,
        referralCode: id,
        walletAddress: wallet.address,
        walletPublicKey: wallet.publicKey
      });
      await user.save();
    }

    res.json({
      accountId: user.accountId,
      balance: user.balance,
      walletAddress: user.walletAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      photo: user.photo
    });
  } catch (err) {
    console.error('Failed to create account:', err);
    res.status(500).json({ error: 'failed to create account' });
  }
});

// Get balance by account id
router.post('/balance', async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });

  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
  const balance = calculateBalance(user);
  if (user.balance !== balance) {
    user.balance = balance;
    try {
      await user.save();
    } catch (err) {
      console.error('Failed to update balance:', err.message);
    }
  }
  res.json({ balance });
});

// Get full account info including gifts and transactions
router.post('/info', async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });

  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });

  ensureTransactionArray(user);
  if (!Array.isArray(user.gifts)) user.gifts = [];

  const balance = calculateBalance(user);
  if (user.balance !== balance) {
    user.balance = balance;
    try {
      await user.save();
    } catch (err) {
      console.error('Failed to update balance:', err.message);
    }
  }

  res.json({
    accountId: user.accountId,
    telegramId: user.telegramId,
    nickname: user.nickname,
    firstName: user.firstName,
    lastName: user.lastName,
    photo: user.photo,
    balance: user.balance,
    gifts: user.gifts,
    transactions: user.transactions
  });
});

// Send TPC between accounts
router.post('/send', async (req, res) => {
  const { fromAccount, toAccount, amount, note } = req.body;
  if (!fromAccount || !toAccount || typeof amount !== 'number') {
    return res
      .status(400)
      .json({ error: 'fromAccount, toAccount and amount required' });
  }
  if (amount <= 0)
    return res.status(400).json({ error: 'amount must be positive' });

  const sender = await User.findOne({ accountId: fromAccount });
  if (!sender) return res.status(404).json({ error: 'sender not found' });
  const feeSender = Math.round(amount * 0.02);
  const feeReceiver = Math.round(amount * 0.01);
  if (sender.balance < amount + feeSender) {
    return res.status(400).json({ error: 'insufficient balance' });
  }

  let receiver = await User.findOne({ accountId: toAccount });
  if (!receiver) {
    receiver = new User({ accountId: toAccount });
  }

  async function getDev(id) {
    if (!id) return null;
    let u = await User.findOne({ accountId: id });
    if (!u) u = new User({ accountId: id });
    return u;
  }

  const devMainId =
    process.env.DEV_ACCOUNT_ID || process.env.VITE_DEV_ACCOUNT_ID;
  const dev1Id =
    process.env.DEV_ACCOUNT_ID_1 || process.env.VITE_DEV_ACCOUNT_ID_1;
  const dev2Id =
    process.env.DEV_ACCOUNT_ID_2 || process.env.VITE_DEV_ACCOUNT_ID_2;

  const devMain = await getDev(devMainId);
  const dev1 = await getDev(dev1Id);
  const dev2 = await getDev(dev2Id);

  ensureTransactionArray(sender);
  ensureTransactionArray(receiver);
  if (devMain) ensureTransactionArray(devMain);
  if (dev1) ensureTransactionArray(dev1);
  if (dev2) ensureTransactionArray(dev2);

  const txDate = new Date();
  sender.balance -= amount + feeSender;
  receiver.balance = (receiver.balance || 0) + amount - feeReceiver;
  if (dev1) {
    dev1.balance = (dev1.balance || 0) + feeReceiver;
  } else if (devMain) {
    devMain.balance = (devMain.balance || 0) + feeReceiver;
  }
  if (dev2) {
    dev2.balance = (dev2.balance || 0) + feeSender;
  } else if (devMain) {
    devMain.balance = (devMain.balance || 0) + feeSender;
  }

  const safeNote = typeof note === 'string' ? note.slice(0, 150) : undefined;
  const senderTx = {
    amount: -(amount + feeSender),
    type: 'send',
    token: 'TPC',
    status: 'delivered',
    date: txDate,
    toAccount: toAccount,
    toName: receiver.nickname || receiver.firstName || '',
    ...(safeNote ? { detail: safeNote } : {})
  };
  const receiverTx = {
    amount: amount - feeReceiver,
    type: 'receive',
    token: 'TPC',
    status: 'delivered',
    date: txDate,
    fromAccount: fromAccount,
    fromName: sender.nickname || sender.firstName || '',
    ...(safeNote ? { detail: safeNote } : {})
  };
  const devTxs = [];
  if (dev1 || devMain) {
    const target = dev1 ? dev1Id : devMainId;
    devTxs.push({
      amount: feeReceiver,
      type: 'fee',
      token: 'TPC',
      status: 'delivered',
      date: txDate,
      fromAccount: fromAccount,
      toAccount: target
    });
  }
  if (dev2 || devMain) {
    const target = dev2 ? dev2Id : devMainId;
    devTxs.push({
      amount: feeSender,
      type: 'fee',
      token: 'TPC',
      status: 'delivered',
      date: txDate,
      fromAccount: fromAccount,
      toAccount: target
    });
  }
  sender.transactions.push(senderTx);
  receiver.transactions.push(receiverTx);
  for (const tx of devTxs) {
    if (dev1 && tx.toAccount === dev1Id) dev1.transactions.push(tx);
    else if (dev2 && tx.toAccount === dev2Id) dev2.transactions.push(tx);
    else if (devMain && tx.toAccount === devMainId)
      devMain.transactions.push(tx);
  }

  await sender.save();
  await receiver.save();
  if (devMain) await devMain.save();
  if (dev1) await dev1.save();
  if (dev2) await dev2.save();

  const devIds = [
    process.env.DEV_ACCOUNT_ID || process.env.VITE_DEV_ACCOUNT_ID,
    process.env.DEV_ACCOUNT_ID_1 || process.env.VITE_DEV_ACCOUNT_ID_1,
    process.env.DEV_ACCOUNT_ID_2 || process.env.VITE_DEV_ACCOUNT_ID_2
  ].filter(Boolean);

  if (receiver.telegramId && !devIds.includes(toAccount)) {
    try {
      await sendTransferNotification(
        bot,
        receiver.telegramId,
        fromAccount,
        amount,
        safeNote
      );
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }
  }

  res.json({ balance: sender.balance, transaction: senderTx });
});

// Send a gift using account ids
router.post('/gift', async (req, res) => {
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
    token: 'TPC',
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
    token: 'TPC',
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
        txDate
      );
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }
  }

  res.json({ balance: sender.balance, transaction: senderTx });
});

// Convert received gifts to TPC
router.post('/convert-gifts', async (req, res) => {
  const { accountId, giftIds, action = 'burn', toAccount } = req.body;
  if (!accountId || !Array.isArray(giftIds)) {
    return res.status(400).json({ error: 'accountId and giftIds required' });
  }

  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });

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
        token: 'TPC',
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
        token: 'TPC',
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
        token: 'TPC',
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
        token: 'TPC',
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
router.post('/transactions', async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });
  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
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

// Deposit rewards into account
router.post('/deposit', authenticate, async (req, res) => {
  const { accountId, amount, game } = req.body;
  const authId = req.auth?.telegramId;
  const devIds = [
    process.env.DEV_ACCOUNT_ID || process.env.VITE_DEV_ACCOUNT_ID,
    process.env.DEV_ACCOUNT_ID_1 || process.env.VITE_DEV_ACCOUNT_ID_1,
    process.env.DEV_ACCOUNT_ID_2 || process.env.VITE_DEV_ACCOUNT_ID_2
  ].filter(Boolean);
  if (!accountId || typeof amount !== 'number' || amount <= 0) {
    return res
      .status(400)
      .json({ error: 'accountId and positive amount required' });
  }
  let user = await User.findOne({ accountId });
  if (!user) {
    user = new User({ accountId });
    if (authId && !devIds.includes(accountId)) user.telegramId = authId;
  }
  if (
    !devIds.includes(accountId) &&
    authId &&
    user.telegramId &&
    authId !== user.telegramId
  ) {
    return res.status(403).json({ error: 'forbidden' });
  }
  ensureTransactionArray(user);
  user.balance += amount;
  const tx = {
    amount,
    type: 'deposit',
    token: 'TPC',
    status: 'delivered',
    date: new Date()
  };
  if (game) tx.game = game;
  user.transactions.push(tx);
  await user.save();

  if (user.telegramId && !devIds.includes(accountId)) {
    try {
      await sendTPCNotification(
        bot,
        user.telegramId,
        `\u{1FA99} Your deposit of ${amount} TPC was credited`
      );
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }
  }
  res.json({ balance: user.balance, transaction: tx });
});

export default router;
