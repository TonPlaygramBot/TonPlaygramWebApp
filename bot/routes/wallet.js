import { Router } from 'express';
import { withProxy } from '../utils/proxyAgent.js';

import User from '../models/User.js';

import bot from '../bot.js';

import { ensureTransactionArray } from '../utils/userUtils.js';

import authenticate from '../middleware/auth.js';

const router = Router();

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

  let user = await User.findOne({ telegramId: id });
  if (!user) {
    user = await User.create({ telegramId: id, referralCode: String(id) });
  }

  res.json({ balance: user.balance });

});

// Provide the server deposit address for TON transfers

router.get('/deposit-address', (_req, res) => {

  const address = process.env.DEPOSIT_WALLET_ADDRESS || '';

  res.json({ address });

});

// Fetch TON balance from the blockchain using a public API

router.post('/ton-balance', authenticate, async (req, res) => {

  const { address } = req.body;

  if (!address) {

    return res.status(400).json({ error: 'address required' });

  }

  try {

    const resp = await fetch(
      `https://toncenter.com/api/v2/getAddressBalance?address=${address}`,
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

router.post('/usdt-balance', authenticate, async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'address required' });
  }
  try {
    const resp = await fetch(
      `https://tonapi.io/v2/accounts/${address}/jettons`,
      withProxy()
    );
    const data = await resp.json();
    const jetton = (data.balances || []).find(
      (j) => j.jetton?.symbol === 'USDT' || j.jetton?.symbol === 'jUSDT'
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

  const { fromId, toId, amount } = req.body;

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

  if (!sender || sender.balance < amount) {

    return res.status(400).json({ error: 'insufficient balance' });

  }

  ensureTransactionArray(sender);

  let receiver = await User.findOne({ telegramId: toId });

  if (receiver) {

    ensureTransactionArray(receiver);

  }

  const txDate = new Date();

  try {

    receiver = await User.findOneAndUpdate(

      { telegramId: toId },

      { $inc: { balance: amount }, $setOnInsert: { referralCode: toId.toString() } },

      { upsert: true, new: true }

    );

    ensureTransactionArray(receiver);

    sender.balance -= amount;

    const senderTx = {

      amount: -amount,

      type: 'send',

      status: 'delivered',

      date: txDate

    };

    const receiverTx = {

      amount,

      type: 'receive',

      status: 'delivered',

      date: txDate

    };

    sender.transactions.push(senderTx);

    receiver.transactions.push(receiverTx);

    await sender.save();

    await receiver.save();

    try {

      await bot.telegram.sendMessage(

        String(toId),

        `You received ${amount} TPC from ${fromId}`

      );

    } catch (err) {

      console.error('Failed to send Telegram notification:', err.message);

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

router.post('/deposit', authenticate, async (req, res) => {

  const { telegramId, amount } = req.body;
  const authId = req.auth?.telegramId;

  if (!telegramId || typeof amount !== 'number' || amount <= 0) {

    return res.status(400).json({ error: 'telegramId and positive amount required' });

  }
  if (!authId || telegramId !== authId) {
    return res.status(403).json({ error: "forbidden" });
  }

  const user = await User.findOneAndUpdate(

    { telegramId },

    { $inc: { balance: amount }, $setOnInsert: { referralCode: telegramId.toString() } },

    { upsert: true, new: true }

  );

  ensureTransactionArray(user);

  const tx = { amount, type: 'deposit', status: 'delivered', date: new Date() };

  user.transactions.push(tx);

  await user.save();

  res.json({ balance: user.balance, transaction: tx });

});

// ✅ Request withdrawal to a TON wallet address

router.post('/withdraw', authenticate, async (req, res) => {

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

  const tx = { amount: -amount, type: 'withdraw', status: 'pending', date: new Date() };

  user.transactions.push(tx);

  await user.save();

  // In a real implementation the server would send TON to `address` here

  res.json({ balance: user.balance, transaction: tx });

});

// ✅ Authenticated transaction history

router.post('/transactions', authenticate, async (req, res) => {

  const { telegramId } = req.body;

  if (!telegramId) {

    return res.status(400).json({ error: 'telegramId required' });

  }
  if (req.auth?.telegramId && telegramId !== req.auth.telegramId) {
    return res.status(403).json({ error: "forbidden" });
  }

  const user = await User.findOne({ telegramId });

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

// Recalculate balance from transaction history
router.post('/recalculate', authenticate, async (req, res) => {
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
    if (!user) return res.status(404).json({ error: 'not found' });
    ensureTransactionArray(user);
    const total = user.transactions.reduce((acc, tx) => {
      const amt = typeof tx.amount === 'number' ? tx.amount : 0;
      return acc + amt;
    }, 0);
    user.balance = total;
    await user.save();
    res.json({ balance: total });
  } catch (err) {
    console.error('Failed to recalculate balance:', err.message);
    res.status(500).json({ error: 'failed to recalc' });
  }
});

export default router;