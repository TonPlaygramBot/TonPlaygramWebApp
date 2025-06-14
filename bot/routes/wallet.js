import { Router } from 'express';
import User from '../models/User.js';
import bot from '../bot.js';

const router = Router();

router.post('/balance', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) {
    return res.status(400).json({ error: 'telegramId required' });
  }
  const user = await User.findOne({ telegramId });
  res.json({ balance: user ? user.balance : 0 });
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

  const txDate = new Date();
  let deducted = false;

  try {
    await User.findOneAndUpdate(
      { telegramId: toId },
      { $inc: { balance: amount }, $setOnInsert: { referralCode: toId.toString() } },
      { upsert: true }
    );

    sender.balance -= amount;
    await sender.save();
    deducted = true;

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

    await User.updateOne(
      { telegramId: fromId },
      {
        $push: { transactions: senderTx }
      }
    );
    await User.updateOne(
      { telegramId: toId },
      {
        $push: { transactions: receiverTx }
      }
    );

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
    await User.updateOne(
      { telegramId: fromId },
      { $push: { transactions: failedTx } }
    ).catch((e) => console.error('Failed to log failed transaction:', e.message));

    // Attempt to revert receiver balance in case it was credited
    await User.updateOne(
      { telegramId: toId },
      { $inc: { balance: -amount } }
    ).catch(() => {});

    // Revert sender deduction if it was saved
    if (deducted) {
      await User.updateOne(
        { telegramId: fromId },
        { $inc: { balance: amount } }
      ).catch(() => {});
    }

    res.status(500).json({ error: 'Failed to send TPC' });
  }
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
