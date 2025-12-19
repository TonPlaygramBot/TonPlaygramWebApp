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
    username: user.username,
    accountId: user.accountId,
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
