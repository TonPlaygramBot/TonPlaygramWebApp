export const MINING_SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours
import User from '../models/User.js';

export function getMiningReward(activeMiners) {
  if (activeMiners < 5000) return 400;
  if (activeMiners < 10000) return 300;
  if (activeMiners < 20000) return 200;
  return 100;
}

export function calculateBoost(referrals) {
  if (referrals >= 100) return 1.0;
  else if (referrals >= 10) return 0.4;
  else if (referrals >= 5) return 0.25;
  else if (referrals >= 4) return 0.2;
  else if (referrals >= 3) return 0.15;
  else if (referrals >= 2) return 0.1;
  else if (referrals >= 1) return 0.05;
  return 0.0;
}

import { ensureTransactionArray } from './userUtils.js';

export async function updateMiningRewards(user) {
  ensureTransactionArray(user);
  if (user.isMining && user.lastMineAt) {
    const diffMs = Date.now() - user.lastMineAt.getTime();
    if (diffMs >= MINING_SESSION_MS) {
      user.isMining = false;
      user.lastMineAt = null;
      user.minedTPC = 0;
      const activeMiners = await User.countDocuments({ isMining: true });
      const baseReward = getMiningReward(activeMiners);
      let storeRate = 0;
      if (user.storeMiningRate && user.storeMiningExpiresAt) {
        if (user.storeMiningExpiresAt > new Date()) {
          storeRate = user.storeMiningRate;
        } else {
          user.storeMiningRate = 0;
          user.storeMiningExpiresAt = null;
        }
      }
      const referralCount = await User.countDocuments({ referredBy: user.referralCode });
      const boost = calculateBoost(referralCount) + storeRate;
      const reward = baseReward * (1 + boost);
      user.balance += reward;
      user.transactions.push({
        amount: reward,
        type: 'mining',
        status: 'delivered',
        date: new Date()
      });
    }
  }
}

export async function startMining(user) {
  ensureTransactionArray(user);
  user.isMining = true;
  user.lastMineAt = new Date();
  await user.save();
}

export async function stopMining(user) {
  ensureTransactionArray(user);
  await updateMiningRewards(user);
  user.isMining = false;
  await user.save();
}

export async function claimRewards(user) {
  ensureTransactionArray(user);
  await updateMiningRewards(user);
  const amount = user.minedTPC;
  user.minedTPC = 0;
  user.balance += amount;
  if (amount > 0) {
    user.transactions.push({
      amount,
      type: 'claim',
      status: 'delivered',
      date: new Date()
    });
  }
  await user.save();
  return amount;
}
