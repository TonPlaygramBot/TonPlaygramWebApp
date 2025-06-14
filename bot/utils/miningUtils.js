export const MINING_SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours
export const MINING_REWARD = 2000;

export function updateMiningRewards(user) {
  if (user.isMining && user.lastMineAt) {
    const diffMs = Date.now() - user.lastMineAt.getTime();
    if (diffMs >= MINING_SESSION_MS) {
      user.isMining = false;
      user.lastMineAt = null;
      user.minedTPC = 0;
      user.balance += MINING_REWARD;
      user.transactions.push({
        amount: MINING_REWARD,
        type: 'mining',
        status: 'delivered',
        date: new Date()
      });
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
