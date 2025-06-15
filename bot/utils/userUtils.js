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
