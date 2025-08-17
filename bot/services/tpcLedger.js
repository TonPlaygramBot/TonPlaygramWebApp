import User from '../models/User.js';

// In-memory reserve tracking per account
const reserves = new Map();

export async function reserveTPC(accountId, amount) {
  const user = await User.findOne({ accountId });
  if (!user) throw new Error('user not found');
  const hold = Math.min(amount, user.balance);
  user.balance -= hold;
  await user.save();
  const current = reserves.get(accountId) || 0;
  reserves.set(accountId, current + hold);
  return hold;
}

export async function debitTPC(accountId, amount) {
  const current = reserves.get(accountId) || 0;
  const spent = Math.min(amount, current);
  reserves.set(accountId, current - spent);
  return spent;
}

export async function creditTPC(accountId, amount) {
  const user = await User.findOneAndUpdate(
    { accountId },
    { $inc: { balance: amount } },
    { new: true }
  );
  return user?.balance ?? 0;
}

export async function releaseReserve(accountId) {
  const current = reserves.get(accountId) || 0;
  if (current > 0) {
    await User.findOneAndUpdate(
      { accountId },
      { $inc: { balance: current } }
    );
    reserves.set(accountId, 0);
  }
  return current;
}
