import User from '../models/User.js';

export function ensureTransactionArray(user) {
  if (!user) return;
  if (typeof user.transactions === 'string') {
    try {
      user.transactions = JSON.parse(user.transactions);
    } catch {
      user.transactions = [];
    }
  }
  if (!Array.isArray(user.transactions)) {
    user.transactions = [];
  }
}

export function calculateBalance(user) {
  if (!user) return 0;
  ensureTransactionArray(user);
  return user.transactions.reduce((acc, tx) => {
    const amt = typeof tx.amount === 'number' ? tx.amount : 0;
    return acc + amt;
  }, 0);
}

// `balance` is updated atomically by deposits, rewards, stakes, and payouts.
// Some older accounts do not have a complete transaction ledger, so summing
// that ledger can be lower than the funds that were actually persisted. Never
// let a read request erase those funds; the ledger may still repair a stale
// persisted value when its total is higher.
export function resolveAccountBalance(user) {
  if (!user) return 0;
  const persisted = Number(user.balance);
  const derived = Number(calculateBalance(user));
  const safePersisted = Number.isFinite(persisted) ? persisted : 0;
  const safeDerived = Number.isFinite(derived) ? derived : 0;
  return Math.max(safePersisted, safeDerived);
}

export async function incrementReferralBonus(code) {
  if (!code) return;
  await User.updateOne(
    { referralCode: code },
    [
      {
        $set: {
          bonusMiningRate: {
            $min: [{ $add: ['$bonusMiningRate', 0.1] }, 2.0]
          }
        }
      }
    ]
  );
}

export function sanitizeUser(user) {
  if (!user) return null;
  return {
    accountId: user.accountId,
    tpcAccountNumber: user.tpcAccountNumber || user.accountId,
    walletAddress: user.walletAddress,
    walletPublicKey: user.walletPublicKey,
    nickname: user.nickname,
    firstName: user.firstName,
    lastName: user.lastName,
    photo: user.photo,
    bio: user.bio,
    balance: user.balance,
    gifts: user.gifts,
    transactions: user.transactions,
    social: user.social
  };
}
