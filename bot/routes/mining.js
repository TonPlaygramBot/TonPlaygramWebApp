import { authenticateRewardAccount, requireVerifiedReward } from '../middleware/rewardGuard.js';
import { Router } from 'express';
import User from '../models/User.js';
import { startMining, stopMining, claimRewards } from '../utils/miningUtils.js';
import { fetchTelegramInfo } from '../utils/telegram.js';

const router = Router();
const AUTHENTIC_LEADERBOARD_QUERY = {
  isBanned: { $ne: true },
  $or: [
    { telegramId: { $exists: true, $ne: null } },
    { googleId: { $exists: true, $nin: ['', null] } }
  ]
};
async function getUser(req, res, next) {
  const { telegramId } = req.body;
  if (!telegramId) {
    return res.status(400).json({ error: 'telegramId required' });
  }
  req.user = await User.findOne({ telegramId });
  if (!req.user) return res.status(404).json({ error: 'account not found' });
  if (req.user.isBanned) return res.status(403).json({ error: 'forbidden' });
  next();
}

router.post('/start', ...authenticateRewardAccount, requireVerifiedReward, getUser, async (req, res) => {
  if (req.user.isMining) {
    return res.json({ message: 'already mining' });
  }
  await startMining(req.user);
  res.json({ message: 'mining started' });
});

router.post('/stop', ...authenticateRewardAccount, requireVerifiedReward, getUser, async (req, res) => {
  if (!req.user.isMining) {
    return res.json({ message: 'not mining' });
  }
  await stopMining(req.user);
  res.json({ message: 'mining stopped', pending: req.user.minedTPC, balance: req.user.balance });
});

router.post('/claim', ...authenticateRewardAccount, requireVerifiedReward, getUser, async (req, res) => {
  const amount = await claimRewards(req.user);
  res.json({ message: 'claimed', amount, balance: req.user.balance });
});

router.post('/status', ...authenticateRewardAccount, getUser, async (req, res) => {
  res.json({ isMining: req.user.isMining, pending: req.user.minedTPC, balance: req.user.balance });
});

router.post('/leaderboard', async (req, res) => {
  const { telegramId, accountId } = req.body || {};
  const tableMap = req.app.get('tableMap') || new Map();
  const gameManager = req.app.get('gameManager');
  const activeTables = new Set([
    ...tableMap.keys(),
    ...(gameManager ? [...gameManager.rooms.keys()] : [])
  ]);
  const users = await User.find(AUTHENTIC_LEADERBOARD_QUERY)
    .sort({ balance: -1 })
    .limit(100)
    .select('telegramId accountId balance nickname firstName lastName photo currentTableId')
    .lean();

  await Promise.all(
    users.map(async (u) => {
      if (u.telegramId && (!u.firstName || !u.lastName || !u.photo)) {
        const info = await fetchTelegramInfo(u.telegramId);
        if (info) {
          await User.updateOne(
            { telegramId: u.telegramId },
            {
              $set: {
                firstName: info.firstName,
                lastName: info.lastName,
                photo: info.photoUrl,
              },
            }
          );
          u.firstName = info.firstName;
          u.lastName = info.lastName;
          u.photo = info.photoUrl;
        }
      }
      if (u.currentTableId && !activeTables.has(u.currentTableId)) {
        await User.updateOne({ accountId: u.accountId }, { currentTableId: null }).catch(() => {});
        u.currentTableId = null;
      }
    })
  );

  let rank = null;
  const queryId = telegramId ? { telegramId } : accountId ? { accountId } : null;
  if (queryId) {
    const user = await User.findOne({ ...AUTHENTIC_LEADERBOARD_QUERY, ...queryId });
    if (user && !user.isBanned) {
      rank = (await User.countDocuments({ ...AUTHENTIC_LEADERBOARD_QUERY, balance: { $gt: user.balance } })) + 1;
    }
  }

  res.json({ users, rank });
});

router.get('/transactions', async (req, res) => {
  const limitParam = Number(req.query.limit) || 100;
  const limit = Math.min(Math.max(limitParam, 1), 1000);
  const transactions = await User.aggregate([
    { $unwind: '$transactions' },
    {
      $match: {
        'transactions.type': { $in: ['daily', 'spin', 'lucky', 'task'] },
        'transactions.amount': { $gt: 0 }
      }
    },
    {
      $project: {
        _id: 0,
        accountId: '$accountId',
        amount: '$transactions.amount',
        type: '$transactions.type',
        date: '$transactions.date',
        token: { $ifNull: ['$transactions.token', 'TPG'] },
        fromAccount: '$accountId',
        fromName: { $ifNull: ['$nickname', '$firstName'] },
        fromPhoto: '$photo'
      }
    },
    { $sort: { date: -1 } },
    { $limit: limit }
  ]);
  res.json({ transactions });
});

export default router;
