export const MINING_RATE_PER_MINUTE = 1;

export function updateMiningRewards(user) {
  if (user.isMining && user.lastMineAt) {
    const diffMs = Date.now() - user.lastMineAt.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes > 0) {
      user.minedTPC += minutes * MINING_RATE_PER_MINUTE;
      user.lastMineAt = new Date();
    }
  }
}

export async function startMining(user) {
  user.isMining = true;
  user.lastMineAt = new Date();
  await user.save();
}

export async function stopMining(user) {
  updateMiningRewards(user);
  user.isMining = false;
  await user.save();
}

export async function claimRewards(user) {
  updateMiningRewards(user);
  const amount = user.minedTPC;
  user.minedTPC = 0;
  user.balance += amount;
  await user.save();
  return amount;
}
