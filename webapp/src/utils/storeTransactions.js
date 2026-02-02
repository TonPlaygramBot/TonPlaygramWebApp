const STORAGE_KEY = 'storeTransactionsByAccount';
const LEGACY_STORAGE_KEY = 'storePurchaseTransactionsByAccount';
const MAX_ENTRIES = 200;

const resolveAccountId = (accountId) => {
  if (accountId) return accountId;
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('accountId');
    if (stored) return stored;
  }
  return 'guest';
};

const normalizeDateKey = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
};

const buildTransactionKey = (tx) =>
  `${tx.type}|${tx.amount}|${tx.detail || ''}|${normalizeDateKey(tx.date)}`;

const readAllTransactions = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const current = raw ? JSON.parse(raw) : {};
    const legacy = legacyRaw ? JSON.parse(legacyRaw) : {};
    const merged = { ...legacy, ...current };
    Object.keys(legacy).forEach((accountId) => {
      const legacyEntries = Array.isArray(legacy[accountId]) ? legacy[accountId] : [];
      const currentEntries = Array.isArray(current[accountId]) ? current[accountId] : [];
      if (!legacyEntries.length) return;
      const seen = new Set(currentEntries.map((tx) => tx?.id || buildTransactionKey(tx)));
      merged[accountId] = [
        ...currentEntries,
        ...legacyEntries.filter((tx) => !seen.has(tx?.id || buildTransactionKey(tx)))
      ];
    });
    return merged;
  } catch (err) {
    console.warn('Failed to read store transactions', err);
    return {};
  }
};

const writeAllTransactions = (payload) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(payload));
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
  const {
    totalPrice = 0,
    detail = 'Store purchase',
    items = [],
    status = 'delivered',
    reference
  } = payload;
  const now = new Date();
  const tx = {
    id: `store-${now.getTime()}-${Math.random().toString(16).slice(2, 8)}`,
    type: 'store',
    amount: -Math.abs(Number(totalPrice) || 0),
    date: now.toISOString(),
    status,
    token: 'TPC',
    detail,
    reference,
    items: items.map((item) => ({
      label: item.label || item.displayLabel || item.name || item.optionId || 'Store item',
      slug: item.slug,
      typeLabel: item.typeLabel || item.type,
      price: item.price
    }))
  };
  const all = readAllTransactions();
  const existing = Array.isArray(all[resolvedAccountId]) ? all[resolvedAccountId] : [];
  const next = [tx, ...existing].slice(0, MAX_ENTRIES);
  writeAllTransactions({
    ...all,
    [resolvedAccountId]: next
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('storeTransactionsUpdate', {
        detail: { accountId: resolvedAccountId, transactions: next }
      })
    );
  }
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
