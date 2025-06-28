import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import authenticate from '../middleware/auth.js';
import { ensureTransactionArray } from '../utils/userUtils.js';

const router = Router();

// Create or fetch account for a user
router.post('/create', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  let user = await User.findOne({ telegramId });
  if (!user) {
    user = new User({ telegramId, accountId: uuidv4(), referralCode: String(telegramId) });
    await user.save();
  } else if (!user.accountId) {
    user.accountId = uuidv4();
    await user.save();
  }

  res.json({ accountId: user.accountId, balance: user.balance });
});

// Get balance by account id
router.post('/balance', async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });

  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });

  res.json({ balance: user.balance });
});

// Send TPC between accounts
router.post('/send', authenticate, async (req, res) => {
  const { fromAccount, toAccount, amount } = req.body;
  const authId = req.auth?.telegramId;
  if (!fromAccount || !toAccount || typeof amount !== 'number') {
    return res.status(400).json({ error: 'fromAccount, toAccount and amount required' });
  }
  if (amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

  const sender = await User.findOne({ accountId: fromAccount });
  if (!sender) return res.status(404).json({ error: 'sender not found' });
  if (authId && sender.telegramId && authId !== sender.telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (sender.balance < amount) {
    return res.status(400).json({ error: 'insufficient balance' });
  }

  let receiver = await User.findOne({ accountId: toAccount });
  if (!receiver) {
    receiver = new User({ accountId: toAccount });
  }

  ensureTransactionArray(sender);
  ensureTransactionArray(receiver);

  const txDate = new Date();
  sender.balance -= amount;
  receiver.balance = (receiver.balance || 0) + amount;

  const senderTx = { amount: -amount, type: 'send', status: 'delivered', date: txDate };
  const receiverTx = { amount, type: 'receive', status: 'delivered', date: txDate };
  sender.transactions.push(senderTx);
  receiver.transactions.push(receiverTx);

  await sender.save();
  await receiver.save();

  res.json({ balance: sender.balance, transaction: senderTx });
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

// Deposit rewards into account
router.post('/deposit', authenticate, async (req, res) => {
  const { accountId, amount } = req.body;
  const authId = req.auth?.telegramId;
  if (!accountId || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'accountId and positive amount required' });
  }
  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
  if (authId && user.telegramId && authId !== user.telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  ensureTransactionArray(user);
  user.balance += amount;
  const tx = { amount, type: 'deposit', status: 'delivered', date: new Date() };
  user.transactions.push(tx);
  await user.save();
  res.json({ balance: user.balance, transaction: tx });
});

export default router;
