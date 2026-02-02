const STORAGE_KEY = 'storeTransactionsByAccount';
const MAX_ENTRIES = 200;

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
    console.warn('Failed to read store transactions', err);
    return {};
  }
};

const writeAllTransactions = (payload) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const normalizeDateKey = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
};

const buildTransactionKey = (tx) =>
  `${tx.type}|${tx.amount}|${tx.detail || ''}|${normalizeDateKey(tx.date)}`;

export const readStoreTransactions = (accountId) => {
  const resolvedAccountId = resolveAccountId(accountId);
  if (resolvedAccountId === 'guest') return [];
  const all = readAllTransactions();
  return Array.isArray(all[resolvedAccountId]) ? all[resolvedAccountId] : [];
};

export const recordStorePurchase = (accountId, payload = {}) => {
  const resolvedAccountId = resolveAccountId(accountId);
  if (resolvedAccountId === 'guest') return null;
  const { totalPrice = 0, detail = 'Store purchase', items = [], status = 'delivered' } = payload;
  const now = new Date();
  const tx = {
    id: `store-${now.getTime()}-${Math.random().toString(16).slice(2, 8)}`,
    type: 'store',
    amount: -Math.abs(Number(totalPrice) || 0),
    date: now.toISOString(),
    status,
    token: 'TPC',
    detail,
    items
  };
  const all = readAllTransactions();
  const existing = Array.isArray(all[resolvedAccountId]) ? all[resolvedAccountId] : [];
  const next = [tx, ...existing].slice(0, MAX_ENTRIES);
  writeAllTransactions({
    ...all,
    [resolvedAccountId]: next
  });
  return tx;
};

export const mergeStoreTransactions = (transactions = [], accountId) => {
  const storeTxs = readStoreTransactions(accountId);
  if (!storeTxs.length) return transactions;
  const existingKeys = new Set(transactions.map(buildTransactionKey));
  const merged = [...transactions];
  storeTxs.forEach((tx) => {
    const key = buildTransactionKey(tx);
    if (!existingKeys.has(key)) {
      merged.push(tx);
    }
  });
  return merged;
};
