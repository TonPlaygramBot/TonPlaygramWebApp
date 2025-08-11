import { Router } from 'express';
import User from '../models/User.js';
import authenticate from '../middleware/auth.js';
import { ensureTransactionArray } from '../utils/userUtils.js';

const router = Router();

function getGamesAccountId() {
  return process.env.GAMES_ACCOUNT_ID || process.env.VITE_GAMES_ACCOUNT_ID;
}

function getDevAccountId() {
  return process.env.DEV_ACCOUNT_ID || process.env.VITE_DEV_ACCOUNT_ID;
}

router.post('/stake', authenticate, async (req, res) => {
  const { accountId, amount, game } = req.body;
  const gamesId = getGamesAccountId();
  if (!gamesId) return res.status(500).json({ error: 'games account not configured' });
  if (!accountId || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'accountId and positive amount required' });
  }
  const user = await User.findOne({ accountId });
  if (!user || user.balance < amount) {
    return res.status(400).json({ error: 'insufficient balance' });
  }
  let gameWallet = await User.findOne({ accountId: gamesId });
  if (!gameWallet) gameWallet = new User({ accountId: gamesId });

  ensureTransactionArray(user);
  ensureTransactionArray(gameWallet);

  const txDate = new Date();
  user.balance -= amount;
  gameWallet.balance = (gameWallet.balance || 0) + amount;

  const userTx = {
    amount: -amount,
    type: 'stake',
    token: 'TPC',
    status: 'delivered',
    date: txDate,
    ...(game ? { game } : {})
  };
  const gameTx = {
    amount,
    type: 'stake',
    token: 'TPC',
    status: 'delivered',
    date: txDate,
    fromAccount: accountId,
    ...(game ? { game } : {})
  };

  user.transactions.push(userTx);
  gameWallet.transactions.push(gameTx);

  await user.save();
  await gameWallet.save();

  res.json({ balance: user.balance, transaction: userTx });
});

router.post('/payout', authenticate, async (req, res) => {
  const { winnerAccountId, amount, game } = req.body;
  const gamesId = getGamesAccountId();
  const devId = getDevAccountId();
  if (!gamesId || !devId) return res.status(500).json({ error: 'wallets not configured' });
  if (!winnerAccountId || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'winnerAccountId and positive amount required' });
  }
  let gameWallet = await User.findOne({ accountId: gamesId });
  if (!gameWallet || gameWallet.balance < amount) {
    return res.status(400).json({ error: 'insufficient game balance' });
  }
  let winner = await User.findOne({ accountId: winnerAccountId });
  if (!winner) winner = new User({ accountId: winnerAccountId });
  let dev = await User.findOne({ accountId: devId });
  if (!dev) dev = new User({ accountId: devId });

  ensureTransactionArray(gameWallet);
  ensureTransactionArray(winner);
  ensureTransactionArray(dev);

  const txDate = new Date();
  const winAmount = Math.round(amount * 0.9);
  const devAmount = amount - winAmount;

  gameWallet.balance -= amount;
  winner.balance = (winner.balance || 0) + winAmount;
  dev.balance = (dev.balance || 0) + devAmount;

  const gameTx = {
    amount: -amount,
    type: 'payout',
    token: 'TPC',
    status: 'delivered',
    date: txDate,
    toAccount: winnerAccountId,
    ...(game ? { game } : {})
  };
  const winnerTx = {
    amount: winAmount,
    type: 'win',
    token: 'TPC',
    status: 'delivered',
    date: txDate,
    fromAccount: gamesId,
    ...(game ? { game } : {})
  };
  const devTx = {
    amount: devAmount,
    type: 'fee',
    token: 'TPC',
    status: 'delivered',
    date: txDate,
    fromAccount: gamesId,
    ...(game ? { game } : {})
  };

  gameWallet.transactions.push(gameTx);
  winner.transactions.push(winnerTx);
  dev.transactions.push(devTx);

  await gameWallet.save();
  await winner.save();
  await dev.save();

  res.json({ winAmount, devAmount });
});

export default router;
