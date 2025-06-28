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
