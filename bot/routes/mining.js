import { Router } from 'express';
import User from '../models/User.js';
import { startMining, stopMining, claimRewards, updateMiningRewards } from '../utils/miningUtils.js';

const router = Router();

async function getUser(req, res, next) {
  const { telegramId } = req.body;
  if (!telegramId) {
    return res.status(400).json({ error: 'telegramId required' });
  }
  req.user = await User.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true }
  );
  next();
}

router.post('/start', getUser, async (req, res) => {
  if (req.user.isMining) {
    return res.json({ message: 'already mining' });
  }
  await startMining(req.user);
  res.json({ message: 'mining started', lastMineAt: req.user.lastMineAt });
});

router.post('/stop', getUser, async (req, res) => {
  if (!req.user.isMining) {
    return res.json({ message: 'not mining' });
  }
  await stopMining(req.user);
  res.json({ message: 'mining stopped', pending: req.user.minedTPC, balance: req.user.balance });
});

router.post('/claim', getUser, async (req, res) => {
  const amount = await claimRewards(req.user);
  res.json({ message: 'claimed', amount, balance: req.user.balance });
});

router.post('/status', getUser, async (req, res) => {
  updateMiningRewards(req.user);
  await req.user.save();
  res.json({
    isMining: req.user.isMining,
    pending: req.user.minedTPC,
    balance: req.user.balance,
    lastMineAt: req.user.lastMineAt
  });
});

export default router;
