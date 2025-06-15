import { Router } from 'express';
import User from '../models/User.js';
import bot from '../bot.js';
import { ensureTransactionArray } from '../utils/userUtils.js';

const router = Router();

router.post('/balance', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) {
    return res.status(400).json({ error: 'telegramId required' });
  }
  const user = await User.findOne({ telegramId });
  res.json({ balance: user ? user.balance : 0 });
});

// Provide the server deposit address for TON transfers
router.get('/deposit-address', (_req, res) => {
  const address = process.env.DEPOSIT_WALLET_ADDRESS || '';
  res.json({ address });
});

// Fetch TON balance from the blockchain using a public API
router.post('/ton-balance', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'address required' });
  }
  try {
    const resp = await fetch(
      `https://toncenter.com/api/v2/getAddressBalance?address=${address}`
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

// Transfer TPC from one Telegram user to another
router.post('/send', async (req, res) => {
  const { fromId, toId, amount } = req.body;
  if (!fromId || !toId || typeof amount !== 'number') {
    return res.status(400).json({ error: 'fromId, toId and amount required' });
  }
  if (amount <= 0) {
    return res.status(400).json({ error: 'amount must be positive' });
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
    sender.balance += amount;
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

// Credit user balance after a TON deposit
router.post('/deposit', async (req, res) => {
  const { telegramId, amount } = req.body;
  if (!telegramId || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'telegramId and positive amount required' });
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

// Request withdrawal to a TON wallet address
router.post('/withdraw', async (req, res) => {
  const { telegramId, address, amount } = req.body;
  if (!telegramId || !address || typeof amount !== 'number' || amount <= 0) {
    return res
      .status(400)
      .json({ error: 'telegramId, address and positive amount required' });
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

router.post('/transactions', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) {
    return res.status(400).json({ error: 'telegramId required' });
  }
  const user = await User.findOne({ telegramId });
  res.json({ transactions: user ? user.transactions : [] });
});

export default router;
