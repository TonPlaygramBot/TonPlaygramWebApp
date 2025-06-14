import { Router } from 'express';

import User from '../models/User.js';

import { startMining, stopMining, claimRewards, updateMiningRewards } from '../utils/miningUtils.js';

const miningRouter = Router();

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

miningRouter.post('/start', getUser, async (req, res) => {

  if (req.user.isMining) {

    return res.json({ message: 'already mining' });

  }

  await startMining(req.user);

  res.json({ message: 'mining started' });

});

miningRouter.post('/stop', getUser, async (req, res) => {

  if (!req.user.isMining) {

    return res.json({ message: 'not mining' });

  }

  await stopMining(req.user);

  res.json({ message: 'mining stopped', pending: req.user.minedTPC, balance: req.user.balance });

});

miningRouter.post('/claim', getUser, async (req, res) => {

  const amount = await claimRewards(req.user);

  res.json({ message: 'claimed', amount, balance: req.user.balance });

});

miningRouter.post('/status', getUser, async (req, res) => {

  updateMiningRewards(req.user);

  await req.user.save();

  res.json({ isMining: req.user.isMining, pending: req.user.minedTPC, balance: req.user.balance });

});

// ✅ GET leaderboard route with basic user info and rank

miningRouter.get('/leaderboard', async (req, res) => {

  const telegramId = req.query.telegramId;

  const top = await User.find()

    .sort({ balance: -1 })

    .limit(100)

    .lean();

  const leaderboard = top.map((u, i) => ({

    telegramId: u.telegramId,

    nickname: u.nickname,

    firstName: u.firstName,

    lastName: u.lastName,

    photo: u.photo,

    balance: u.balance,

    rank: i + 1

  }));

  let myRank = null;

  if (telegramId) {

    const me = await User.findOne({ telegramId }).lean();

    if (me) {

      myRank = (await User.countDocuments({ balance: { $gt: me.balance } })) + 1;

    }

  }

  res.json({ leaderboard, myRank });

});

export { miningRouter };