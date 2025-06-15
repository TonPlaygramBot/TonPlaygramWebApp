export function ensureTransactionArray(user) {
  if (!user) return false;
  let modified = false;
  if (typeof user.transactions === 'string') {
    try {
      user.transactions = JSON.parse(user.transactions);
    } catch {
      user.transactions = [];
    }
    modified = true;
  }
  if (!Array.isArray(user.transactions)) {
    user.transactions = [];
    modified = true;
  }
  return modified;
}
