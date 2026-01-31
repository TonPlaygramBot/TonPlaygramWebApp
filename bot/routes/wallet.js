import { Router } from 'express';
import { withProxy } from '../utils/proxyAgent.js';
import crypto from 'crypto';

import User from '../models/User.js';

import bot from '../bot.js';
import Message from '../models/Message.js';
import { sendTransferNotification, sendTPCNotification } from '../utils/notifications.js';

import { ensureTransactionArray, calculateBalance } from '../utils/userUtils.js';

import authenticate, { requireApiToken } from '../middleware/auth.js';
import tonClaim from '../utils/tonClaim.js';
import { verifyRewardReceipt, signRewardReceipt } from '../utils/rewardReceipt.js';

const WITHDRAW_ENABLED = process.env.WITHDRAW_ENABLED === 'true';

// Track USDT using the official jetton master address on TON
const USDT_JETTON_HEX =
  '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe';

// Token root address used when directing users to import TPC
const TPC_JETTON_ADDRESS =
  process.env.TPC_JETTON_ADDRESS ||
  'EQDY3qbfGN6IMI5d4MsEoprhuMTz09OkqjyhPKX6DVtzbi6X';

const router = Router();

function enforceRewardLimit(amount) {
  const maxReward = Number(process.env.REWARD_MAX_AMOUNT) || 1000;
  return Number.isFinite(amount) && amount > 0 && amount <= maxReward;
}

router.post('/balance', authenticate, async (req, res) => {

  const { telegramId } = req.body;
  const authId = req.auth?.telegramId;

  const id = telegramId || authId;
  if (!id) {
    return res.status(400).json({ error: "telegramId required" });
  }
  if (telegramId && authId && telegramId !== authId) {
    return res.status(403).json({ error: "forbidden" });
  }

  const user = await User.findOneAndUpdate(
    { telegramId: id },
    { $setOnInsert: { referralCode: String(id) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
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

// Transfer TPC from one Telegram user to another

router.post('/send', authenticate, async (req, res) => {

  const { fromId, toId, amount, note } = req.body;

  const authId = req.auth?.telegramId;
  if (!fromId || !toId || typeof amount !== 'number') {

    return res.status(400).json({ error: 'fromId, toId and amount required' });

  }

  if (amount <= 0) {

    return res.status(400).json({ error: 'amount must be positive' });

  }
  if (!authId || fromId !== authId) {
    return res.status(403).json({ error: "forbidden" });
  }

  const sender = await User.findOne({ telegramId: fromId });

  ensureTransactionArray(sender);

  if (!sender) {
    return res.status(400).json({ error: 'insufficient balance' });
  }

  const senderBalance = calculateBalance(sender);
  sender.balance = senderBalance;

  if (senderBalance < amount) {
    return res.status(400).json({ error: 'insufficient balance' });
  }

  let receiver = await User.findOne({ telegramId: toId });

  if (receiver) {

    ensureTransactionArray(receiver);

  }

  const txDate = new Date();

  try {

    receiver = await User.findOneAndUpdate(

      { telegramId: toId },

      { $inc: { balance: amount }, $setOnInsert: { referralCode: toId.toString() } },

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
      toAccount: String(toId),
      toName: receiver.nickname || receiver.firstName || '',
      ...(safeNote ? { detail: safeNote } : {})
    };

    const receiverTx = {
      amount,
      type: 'receive',
      token: 'TPC',
      status: 'delivered',
      date: txDate,
      fromAccount: String(fromId),
      fromName: sender.nickname || sender.firstName || '',
      ...(safeNote ? { detail: safeNote } : {})
    };

    sender.transactions.push(senderTx);

    receiver.transactions.push(receiverTx);

    await sender.save();

    await receiver.save();

    const senderName =
      sender.nickname || sender.firstName || String(fromId);
    const receiverBalance = receiver.balance;
    const noteText = safeNote ? ` Note: ${safeNote}` : '';
    const detailText =
      `You received ${amount} TPC from ${senderName} on ${txDate.toLocaleString()}. ` +
      `New balance: ${receiverBalance} TPC.` + noteText;

    try {
      await sendTransferNotification(bot, toId, fromId, amount, safeNote);
      await bot.telegram.sendMessage(String(toId), detailText);
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }

    try {
      await Message.create({
        from: 0,
        to: Number(toId),
        text: detailText,
      });
    } catch (err) {
      console.error('Failed to create inbox message:', err.message);
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

      { telegramId: toId },

      { $inc: { balance: -amount } }

    ).catch(() => {});

    res.status(500).json({ error: 'Failed to send TPC' });

  }

});

// ✅ Credit user balance after a TON deposit

router.post('/deposit', authenticate, requireApiToken, async (req, res) => {

  const { telegramId, amount, receipt, nonce, ts } = req.body;
  const authId = req.auth?.telegramId;
  const isApiToken = req.auth?.apiToken;
  const secret = process.env.REWARD_SIGNING_SECRET;

  if (!telegramId || typeof amount !== 'number' || amount <= 0) {

    return res.status(400).json({ error: 'telegramId and positive amount required' });

  }
  if (!enforceRewardLimit(amount)) {
    return res.status(400).json({ error: 'amount exceeds limit' });
  }
  if (!receipt || !nonce || !ts) {
    if (!isApiToken) {
      return res.status(400).json({ error: 'receipt, nonce and ts required' });
    }
  } else {
    const check = verifyRewardReceipt(
      { purpose: 'wallet_deposit', telegramId, amount, nonce, ts },
      receipt,
      secret
    );
    if (!check.ok) {
      const status = check.error === 'missing_secret' ? 503 : 403;
      return res.status(status).json({ error: 'invalid receipt' });
    }
  }
  if (!isApiToken && (!authId || telegramId !== authId)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const user = await User.findOneAndUpdate(

    { telegramId },

    { $inc: { balance: amount }, $setOnInsert: { referralCode: telegramId.toString() } },

    { upsert: true, new: true, setDefaultsOnInsert: true }

  );

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
      telegramId,
      `\u{1FA99} Your deposit of ${amount} TPC was credited`
    );
  } catch (err) {
    console.error('Failed to send Telegram notification:', err.message);
  }

  res.json({ balance: user.balance, transaction: tx });

});

router.post('/receipt', authenticate, async (req, res) => {
  const { telegramId, amount } = req.body;
  if (!telegramId || typeof amount !== 'number') {
    return res.status(400).json({ error: 'telegramId and amount required' });
  }
  if (!enforceRewardLimit(amount)) {
    return res.status(400).json({ error: 'amount exceeds limit' });
  }
  if (!req.auth?.telegramId || telegramId !== req.auth.telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const secret = process.env.REWARD_SIGNING_SECRET;
  if (!secret) return res.status(503).json({ error: 'receipt unavailable' });
  const nonce = crypto.randomUUID();
  const ts = Date.now();
  const receipt = signRewardReceipt(
    { purpose: 'wallet_deposit', telegramId, amount, nonce, ts },
    secret
  );
  res.json({ receipt, nonce, ts });
});

router.post('/claim-reward', authenticate, async (req, res) => {
  const { telegramId, amount, receipt, nonce, ts } = req.body;
  if (!telegramId || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'telegramId and positive amount required' });
  }
  if (!enforceRewardLimit(amount)) {
    return res.status(400).json({ error: 'amount exceeds limit' });
  }
  if (!receipt || !nonce || !ts) {
    return res.status(400).json({ error: 'receipt, nonce and ts required' });
  }
  if (!req.auth?.telegramId || telegramId !== req.auth.telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const check = verifyRewardReceipt(
    { purpose: 'wallet_deposit', telegramId, amount, nonce, ts },
    receipt,
    process.env.REWARD_SIGNING_SECRET
  );
  if (!check.ok) {
    const status = check.error === 'missing_secret' ? 503 : 403;
    return res.status(status).json({ error: 'invalid receipt' });
  }
  const user = await User.findOneAndUpdate(
    { telegramId },
    { $inc: { balance: amount }, $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
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
      telegramId,
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

  const { telegramId, address, amount } = req.body;
  const authId = req.auth?.telegramId;

  if (!telegramId || !address || typeof amount !== 'number' || amount <= 0) {

    return res

      .status(400)

      .json({ error: 'telegramId, address and positive amount required' });

  }
  if (!authId || telegramId !== authId) {
    return res.status(403).json({ error: "forbidden" });
  }

  const user = await User.findOne({ telegramId });

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
        telegramId,
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
  const { telegramId, address, amount } = req.body;
  const authId = req.auth?.telegramId;

  if (!telegramId || !address || typeof amount !== 'number' || amount <= 0) {
    return res
      .status(400)
      .json({ error: 'telegramId, address and positive amount required' });
  }
  if (!authId || telegramId !== authId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const user = await User.findOne({ telegramId });

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
        telegramId,
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
    if (
      req.auth?.telegramId &&
      user.telegramId &&
      user.telegramId !== req.auth.telegramId
    ) {
      return res.status(403).json({ error: 'forbidden' });
    }
  } else {
    if (req.auth?.telegramId && telegramId !== req.auth.telegramId) {
      return res.status(403).json({ error: 'forbidden' });
    }
    user = await User.findOne({ telegramId });
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
  const { telegramId } = req.body;
  const authId = req.auth?.telegramId;
  if (!telegramId) {
    return res.status(400).json({ error: 'telegramId required' });
  }
  if (!authId || telegramId !== authId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const user = await User.findOne({ telegramId });
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
