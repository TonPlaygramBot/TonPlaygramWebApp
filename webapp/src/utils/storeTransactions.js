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

const normalizeTransactionType = (value) => {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'storefront' || type === 'store-front' || type === 'store_front') {
    return 'store';
  }
  return type;
};

const buildTransactionKey = (tx) => {
  const type = normalizeTransactionType(tx?.type);
  const amount = Number(tx?.amount) || 0;
  const dateKey = normalizeDateKey(tx?.date);
  if (type === 'store') {
    return `${type}|${amount}|${dateKey}`;
  }
  return `${type}|${amount}|${tx?.detail || ''}|${dateKey}`;
};

const normalizeStoreTransaction = (tx) => {
  const normalizedType = normalizeTransactionType(tx?.type);
  if (!normalizedType || normalizedType === tx?.type) return tx;
  return {
    ...tx,
    type: normalizedType
  };
};

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
  const normalizedTransactions = transactions.map(normalizeStoreTransaction);
  const storeTxs = readStoreTransactions(accountId).map(normalizeStoreTransaction);
  if (!storeTxs.length) return normalizedTransactions;
  const existingKeys = new Set(normalizedTransactions.map(buildTransactionKey));
  const merged = [...normalizedTransactions];
  storeTxs.forEach((tx) => {
    const key = buildTransactionKey(tx);
    if (!existingKeys.has(key)) {
      merged.push(tx);
    }
  });
  return merged;
};

const toValidDate = (value) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const sortByNewestDate = (entries = []) =>
  [...entries].sort((a, b) => {
    const first = toValidDate(a?.date)?.getTime() || 0;
    const second = toValidDate(b?.date)?.getTime() || 0;
    return second - first;
  });

export const getLastStorePurchase = (accountId) => {
  const transactions = readStoreTransactions(accountId);
  if (!transactions.length) return null;
  const [latest] = sortByNewestDate(transactions);
  return latest || null;
};

export const getLastStorePurchaseSnapshot = () => {
  const all = readAllTransactions();
  const snapshots = Object.entries(all)
    .filter(([accountId, txs]) => accountId && accountId !== 'guest' && Array.isArray(txs) && txs.length)
    .map(([accountId, txs]) => {
      const [latest] = sortByNewestDate(txs);
      return latest ? { accountId, transaction: latest } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      const first = toValidDate(a.transaction?.date)?.getTime() || 0;
      const second = toValidDate(b.transaction?.date)?.getTime() || 0;
      return second - first;
    });
  return snapshots[0] || null;
};
