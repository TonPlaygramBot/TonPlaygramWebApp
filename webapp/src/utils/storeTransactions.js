const STORAGE_KEY = 'storePurchaseTransactionsByAccount';

const resolveAccountId = (accountId) => {
  if (accountId) return accountId;
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('accountId');
    if (stored) return stored;
  }
  return 'guest';
};

const readAllTransactions = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('Failed to read store transactions, resetting', err);
    return {};
  }
};

const writeAllTransactions = (payload) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const buildStoreEntry = ({ items, totalPrice, reference, status }) => {
  const timestamp = new Date().toISOString();
  const idSuffix = Math.random().toString(36).slice(2, 10);
  return {
    id: `store-${timestamp}-${idSuffix}`,
    type: 'store',
    amount: -Math.abs(Number(totalPrice) || 0),
    date: timestamp,
    status: status || 'delivered',
    token: 'TPC',
    reference,
    items: (items || []).map((item) => ({
      label: item.displayLabel || item.name || item.optionId || 'Store item',
      slug: item.slug,
      typeLabel: item.typeLabel || item.type
    }))
  };
};

export const getStoreTransactions = (accountId) => {
  const resolvedAccountId = resolveAccountId(accountId);
  const allTransactions = readAllTransactions();
  const entries = Array.isArray(allTransactions[resolvedAccountId])
    ? allTransactions[resolvedAccountId]
    : [];
  return entries.slice();
};

export const recordStorePurchase = (accountId, purchase) => {
  if (!purchase) return [];
  const resolvedAccountId = resolveAccountId(accountId);
  const entry = buildStoreEntry(purchase);
  const allTransactions = readAllTransactions();
  const existing = Array.isArray(allTransactions[resolvedAccountId])
    ? allTransactions[resolvedAccountId]
    : [];
  const nextTransactions = [entry, ...existing];
  writeAllTransactions({
    ...allTransactions,
    [resolvedAccountId]: nextTransactions
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('storeTransactionsUpdate', {
        detail: { accountId: resolvedAccountId, transactions: nextTransactions }
      })
    );
  }
  return nextTransactions;
};

export const mergeStoreTransactions = (accountId, transactions = []) => {
  const base = Array.isArray(transactions) ? transactions.slice() : [];
  const storeEntries = getStoreTransactions(accountId);
  if (!storeEntries.length) return base;
  const seen = new Set(base.map((tx) => tx.id || tx.txHash || `${tx.type}-${tx.date}-${tx.amount}`));
  storeEntries.forEach((entry) => {
    if (!seen.has(entry.id)) {
      base.push(entry);
    }
  });
  return base;
};
