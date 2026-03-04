import { Router } from 'express';
import { withProxy } from '../utils/proxyAgent.js';
import crypto from 'crypto';

import User from '../models/User.js';

import bot from '../bot.js';
import Message from '../models/Message.js';
import { sendTransferNotification, sendTPCNotification } from '../utils/notifications.js';

import { ensureTransactionArray, calculateBalance } from '../utils/userUtils.js';

import authenticate from '../middleware/auth.js';
import tonClaim from '../utils/tonClaim.js';

const WITHDRAW_ENABLED = process.env.WITHDRAW_ENABLED === 'true';

// Track USDT using the official jetton master address on TON
const USDT_JETTON_HEX =
  '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe';

// Token root address used when directing users to import TPC
const TPC_JETTON_ADDRESS =
  process.env.TPC_JETTON_ADDRESS ||
  'EQDY3qbfGN6IMI5d4MsEoprhuMTz09OkqjyhPKX6DVtzbi6X';

const router = Router();

function canAccessUser(req, user) {
  if (!user) return false;
  if (req.auth?.apiToken) return true;
  if (user.telegramId && req.auth?.telegramId && user.telegramId === req.auth.telegramId) return true;
  if (user.googleId && req.auth?.googleId && user.googleId === req.auth.googleId) return true;
  if (user.accountId && req.auth?.accountId && user.accountId === req.auth.accountId) return true;
  return !user.telegramId && !user.googleId;
}

async function getAuthenticatedUser(req) {
  if (req.auth?.accountId) {
    return User.findOne({ accountId: req.auth.accountId });
  }
  if (req.auth?.telegramId) {
    return User.findOne({ telegramId: req.auth.telegramId });
  }
  if (req.auth?.googleId) {
    return User.findOne({ googleId: req.auth.googleId });
  }
  return null;
}

router.post('/balance', authenticate, async (req, res) => {

  const { telegramId, accountId } = req.body;

  let user;
  if (accountId) {
    user = await User.findOne({ accountId });
    if (user && !canAccessUser(req, user)) {
      return res.status(403).json({ error: 'forbidden' });
    }
  } else if (telegramId) {
    user = await User.findOne({ telegramId });
    if (user && !canAccessUser(req, user)) {
      return res.status(403).json({ error: 'forbidden' });
    }
  } else {
    user = await getAuthenticatedUser(req);
  }

  if (!user) {
    if (req.auth?.telegramId) {
      user = await User.findOneAndUpdate(
        { telegramId: req.auth.telegramId },
        { $setOnInsert: { referralCode: String(req.auth.telegramId) } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else if (req.auth?.googleId) {
      user = await User.findOneAndUpdate(
        { googleId: req.auth.googleId },
        { $setOnInsert: { referralCode: String(req.auth.googleId) } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  if (!user) {
    return res.status(400).json({ error: 'accountId or telegramId required' });
  }

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

// Provide the server deposit address for TON transfers

router.get('/deposit-address', (_req, res) => {

  const address = process.env.DEPOSIT_WALLET_ADDRESS || '';

  res.json({ address });

});

// Fetch TON balance from the blockchain using a public API

import TonWeb from 'tonweb';

function toFriendlyAddress(addr) {
  try {
    const a = new TonWeb.utils.Address(addr);
    // return standard base64 (not URL-safe) user-friendly address
    return a.toString(true, false, false);
  } catch {
    return null;
  }
}

router.post('/ton-balance', async (req, res) => {

  const { address } = req.body;

  if (!address) {
    return res.status(400).json({ error: 'address required' });
  }

  const raw = toFriendlyAddress(address);
  if (!raw) {
    return res.status(400).json({ error: 'invalid address' });
  }

  try {

    const resp = await fetch(
      `https://toncenter.com/api/v2/getAddressBalance?address=${encodeURIComponent(raw)}`,
      withProxy()
    );

    const data = await resp.json();

    if (!data.ok) {

      return res.status(400).json({ error: data.error || 'failed to fetch' });

    }

    const balance = Number(data.result) / 1e9; // nanotons -> TON

    res.json({ balance });

  } catch (err) {

    console.error('Error fetching TON balance:', err);

    res.status(500).json({ error: 'Failed to fetch TON balance' });

  }

});

router.post('/usdt-balance', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'address required' });
  }
  const raw = toFriendlyAddress(address);
  if (!raw) {
    return res.status(400).json({ error: 'invalid address' });
  }
  try {
    const resp = await fetch(
      `https://tonapi.io/v2/accounts/${encodeURIComponent(raw)}/jettons`,
      withProxy()
    );
    const data = await resp.json();
    const jetton = (data.balances || []).find(
      (j) =>
        j.jetton?.address === USDT_JETTON_HEX ||
        j.jetton?.symbol === 'USDT' ||
        j.jetton?.symbol === 'jUSDT'
    );
    let balance = 0;
    if (jetton) {
      const decimals = jetton.jetton?.decimals || 0;
      balance = Number(jetton.balance) / 10 ** decimals;
    }
    res.json({ balance });
  } catch (err) {
    console.error('Error fetching USDT balance:', err);
    res.status(500).json({ error: 'Failed to fetch USDT balance' });
  }
});

// Transfer TPC between any authenticated users (Telegram or Google)

router.post('/send', authenticate, async (req, res) => {

  const { fromId, toId, fromAccountId, toAccountId, amount, note } = req.body;
  const senderFilter = fromAccountId ? { accountId: fromAccountId } : { telegramId: fromId };
  const receiverFilter = toAccountId ? { accountId: toAccountId } : { telegramId: toId };

  if ((!fromId && !fromAccountId) || (!toId && !toAccountId) || typeof amount !== 'number') {

    return res.status(400).json({ error: 'fromId, toId and amount required' });

  }

  if (amount <= 0) {

    return res.status(400).json({ error: 'amount must be positive' });

  }
  const sender = await User.findOne(senderFilter);
  if (!sender || !canAccessUser(req, sender)) {
    return res.status(403).json({ error: "forbidden" });
  }

  ensureTransactionArray(sender);

  const senderBalance = calculateBalance(sender);
  sender.balance = senderBalance;

  if (senderBalance < amount) {
    return res.status(400).json({ error: 'insufficient balance' });
  }

  let receiver = await User.findOne(receiverFilter);

  if (receiver) {

    ensureTransactionArray(receiver);

  }

  const txDate = new Date();

  try {

    receiver = await User.findOneAndUpdate(

      receiverFilter,

      {
        $inc: { balance: amount },
        $setOnInsert: { referralCode: String(toAccountId || toId) }
      },

      { upsert: true, new: true, setDefaultsOnInsert: true }

    );

    ensureTransactionArray(receiver);

    sender.balance -= amount;

    const safeNote = typeof note === 'string' ? note.slice(0, 150) : undefined;

    const senderTx = {
      amount: -amount,
      type: 'send',
      token: 'TPC',
      status: 'delivered',
      date: txDate,
      toAccount: String(receiver.accountId || toAccountId || toId),
      toName: receiver.nickname || receiver.firstName || '',
      ...(safeNote ? { detail: safeNote } : {})
    };

    const receiverTx = {
      amount,
      type: 'receive',
      token: 'TPC',
      status: 'delivered',
      date: txDate,
      fromAccount: String(sender.accountId || fromAccountId || fromId),
      fromName: sender.nickname || sender.firstName || '',
      ...(safeNote ? { detail: safeNote } : {})
    };

    sender.transactions.push(senderTx);

    receiver.transactions.push(receiverTx);

    await sender.save();

    await receiver.save();

    const senderName =
      sender.nickname || sender.firstName || String(sender.accountId || fromAccountId || fromId);
    const receiverBalance = receiver.balance;
    const noteText = safeNote ? ` Note: ${safeNote}` : '';
    const detailText =
      `You received ${amount} TPC from ${senderName} on ${txDate.toLocaleString()}. ` +
      `New balance: ${receiverBalance} TPC.` + noteText;

    try {
      if (receiver.telegramId) {
        await sendTransferNotification(bot, receiver.telegramId, sender.telegramId, amount, safeNote);
        await bot.telegram.sendMessage(String(receiver.telegramId), detailText);
      }
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }

    if (receiver.telegramId) {
      try {
        await Message.create({
          from: 0,
          to: Number(receiver.telegramId),
          text: detailText,
        });
      } catch (err) {
        console.error('Failed to create inbox message:', err.message);
      }
    }

    return res.json({ balance: sender.balance, transaction: senderTx });

  } catch (err) {

    console.error('Failed to complete TPC transfer:', err.message);

    const failedTx = {

      amount: -amount,

      type: 'send',

      status: 'failed',

      date: txDate

    };

    sender.balance += amount;

    sender.transactions.push(failedTx);

    await sender.save().catch((e) =>

      console.error('Failed to log failed transaction:', e.message)

    );

    // Attempt to revert receiver balance in case it was credited

    await User.updateOne(

      receiverFilter,

      { $inc: { balance: -amount } }

    ).catch(() => {});

    res.status(500).json({ error: 'Failed to send TPC' });

  }

});

// ✅ Credit user balance after a TON deposit

router.post('/deposit', authenticate, async (req, res) => {

  const { telegramId, accountId, amount } = req.body;

  if ((!telegramId && !accountId) || typeof amount !== 'number' || amount <= 0) {

    return res.status(400).json({ error: 'telegramId or accountId and positive amount required' });

  }
  let user = await User.findOne(accountId ? { accountId } : { telegramId });
  if (user && !canAccessUser(req, user)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (!user) {
    user = await User.findOneAndUpdate(
      accountId ? { accountId } : { telegramId },
      {
        $inc: { balance: amount },
        $setOnInsert: { referralCode: String(accountId || telegramId) }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } else {
    user.balance += amount;
  }

  ensureTransactionArray(user);

  const tx = {
    amount,
    type: 'deposit',
    token: 'TPC',
    status: 'delivered',
    date: new Date()
  };

  user.transactions.push(tx);

  await user.save();

  try {
    await sendTPCNotification(
      bot,
      user.telegramId,
      `\u{1FA99} Your deposit of ${amount} TPC was credited`
    );
  } catch (err) {
    console.error('Failed to send Telegram notification:', err.message);
  }

  res.json({ balance: user.balance, transaction: tx });

});

// ✅ Request withdrawal to a TON wallet address

router.post('/withdraw', authenticate, async (req, res) => {

  if (!WITHDRAW_ENABLED) {
    return res.status(403).json({ error: 'withdrawals disabled' });
  }

  const { telegramId, accountId, address, amount } = req.body;

  if ((!telegramId && !accountId) || !address || typeof amount !== 'number' || amount <= 0) {

    return res

      .status(400)

      .json({ error: 'telegramId or accountId, address and positive amount required' });

  }
  const user = await User.findOne(accountId ? { accountId } : { telegramId });
  if (!user || !canAccessUser(req, user)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  if (!user || user.balance < amount) {

    return res.status(400).json({ error: 'insufficient balance' });

  }

  ensureTransactionArray(user);

  user.balance -= amount;

  const tx = {
    amount: -amount,
    type: 'withdraw',
    token: 'TPC',
    status: 'pending',
    date: new Date()
  };

  user.transactions.push(tx);

  await user.save();

  try {
    await tonClaim(address, amount);
    tx.status = 'delivered';
    await user.save();
    try {
      await sendTPCNotification(
        bot,
        user.telegramId,
        `\u{1FA99} Claim of ${amount} TPC sent to ${address}. If it doesn't appear, add TPC using ${TPC_JETTON_ADDRESS}`
      );
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }
    return res.json({ balance: user.balance, transaction: tx });
  } catch (err) {
    console.error('Claim transaction failed:', err.message);
    user.balance += amount;
    tx.status = 'failed';
    user.transactions.pop();
    await user.save();
    return res.status(500).json({ error: 'claim failed' });
  }

});

// ✅ Claim TPC to an external TON wallet
router.post('/claim-external', authenticate, async (req, res) => {
  const { telegramId, accountId, address, amount } = req.body;

  if ((!telegramId && !accountId) || !address || typeof amount !== 'number' || amount <= 0) {
    return res
      .status(400)
      .json({ error: 'telegramId or accountId, address and positive amount required' });
  }

  const user = await User.findOne(accountId ? { accountId } : { telegramId });
  if (!user || !canAccessUser(req, user)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  if (!user || user.balance < amount) {
    return res.status(400).json({ error: 'insufficient balance' });
  }

  ensureTransactionArray(user);

  user.balance -= amount;

  const tx = {
    amount: -amount,
    type: 'withdraw',
    token: 'TPC',
    status: 'pending',
    date: new Date(),
    address,
  };

  user.transactions.push(tx);
  await user.save();
  try {
    await tonClaim(address, amount);
    tx.status = 'delivered';
    await user.save();
    try {
      await sendTPCNotification(
        bot,
        user.telegramId,
        `\u{1FA99} Claim of ${amount} TPC sent to ${address}. If it doesn't appear, add TPC using ${TPC_JETTON_ADDRESS}`
      );
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }
    return res.json({ balance: user.balance, transaction: tx });
  } catch (err) {
    console.error('Claim transaction failed:', err.message);
    user.balance += amount;
    tx.status = 'failed';
    user.transactions.pop();
    await user.save();
    return res.status(500).json({ error: 'claim failed' });
  }
});

// ✅ Authenticated transaction history

router.post('/transactions', authenticate, async (req, res) => {

  const { telegramId, accountId } = req.body;

  if (!telegramId && !accountId) {

    return res.status(400).json({ error: 'telegramId or accountId required' });

  }

  let user;
  if (accountId) {
    user = await User.findOne({ accountId });
    if (!user) {
      return res.status(404).json({ error: 'account not found' });
    }
    if (!canAccessUser(req, user)) {
      return res.status(403).json({ error: 'forbidden' });
    }
  } else {
    user = await User.findOne({ telegramId });
    if (user && !canAccessUser(req, user)) {
      return res.status(403).json({ error: 'forbidden' });
    }
  }

  if (user) {
    // Ensure the transactions property is always an array
    ensureTransactionArray(user);

    // Persist fixes for legacy string data
    if (user.isModified('transactions')) {
      try {
        await user.save();
      } catch (err) {
        console.error(
          'Failed to save user after ensuring transaction array:',
          err.message
        );
      }
    }
  }

  res.json({ transactions: user ? user.transactions : [] });

});


// Reset TPC wallet balance and history
router.post('/reset', authenticate, async (req, res) => {
  const { telegramId, accountId } = req.body;
  if (!telegramId && !accountId) {
    return res.status(400).json({ error: 'telegramId or accountId required' });
  }
  try {
    const user = await User.findOne(accountId ? { accountId } : { telegramId });
    if (user && !canAccessUser(req, user)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (user) {
      user.balance = 0;
      user.minedTPC = 0;
      user.transactions = [];
      await user.save();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to reset wallet:', err.message);
    res.status(500).json({ error: 'failed to reset wallet' });
  }
});

export default router;
