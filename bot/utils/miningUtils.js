export const MINING_SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours
import User from '../models/User.js';

export function getMiningReward(activeMiners) {
  if (activeMiners < 5000) return 1000;
  if (activeMiners < 10000) return 750;
  if (activeMiners < 20000) return 500;
  return 250;
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
      const baseRate = 1;
      const activeMiners = await User.countDocuments({ isMining: true });
      const miningMultiplier = getMiningReward(activeMiners);
      let storeRate = 0;
      if (user.storeMiningRate && user.storeMiningExpiresAt) {
        if (user.storeMiningExpiresAt > new Date()) {
          storeRate = user.storeMiningRate;
        } else {
          user.storeMiningRate = 0;
          user.storeMiningExpiresAt = null;
        }
      }
      const totalRate = baseRate + (user.bonusMiningRate || 0) + storeRate;
      const reward = totalRate * miningMultiplier;
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
