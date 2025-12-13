import {
  BLACKJACK_DEFAULT_LOADOUT,
  BLACKJACK_DEFAULT_UNLOCKS,
  BLACKJACK_OPTION_LABELS
} from '../config/blackjackInventoryConfig.js';

const STORAGE_KEY = 'blackjackInventoryByAccount';

const copyDefaults = () =>
  Object.entries(BLACKJACK_DEFAULT_UNLOCKS).reduce((acc, [key, values]) => {
    acc[key] = Array.isArray(values) ? [...values].filter(Boolean) : [];
    return acc;
  }, {});

const resolveAccountId = (accountId) => {
  if (accountId) return accountId;
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('accountId');
    if (stored) return stored;
  }
  return 'guest';
};

const readAllInventories = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('Failed to read blackjack inventory, resetting', err);
    return {};
  }
};

const writeAllInventories = (payload) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const normalizeInventory = (rawInventory) => {
  const base = copyDefaults();
  if (!rawInventory || typeof rawInventory !== 'object') return base;
  const merged = { ...base };
  Object.entries(rawInventory).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    merged[key] = Array.from(new Set([...(merged[key] || []), ...value]));
  });
  return merged;
};

export const getBlackjackInventory = (accountId) => {
  const resolvedAccountId = resolveAccountId(accountId);
  const inventories = readAllInventories();
  const normalized = normalizeInventory(inventories[resolvedAccountId]);
  if (typeof window !== 'undefined') {
    writeAllInventories({
      ...inventories,
      [resolvedAccountId]: normalized
    });
  }
  return normalized;
};

export const isBlackjackOptionUnlocked = (type, optionId, inventoryOrAccountId) => {
  if (!type || !optionId) return false;
  const inventory =
    typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId
      ? getBlackjackInventory(inventoryOrAccountId)
      : inventoryOrAccountId;
  return Array.isArray(inventory?.[type]) && inventory[type].includes(optionId);
};

export const addBlackjackUnlock = (type, optionId, accountId) => {
  const resolvedAccountId = resolveAccountId(accountId);
  const inventories = readAllInventories();
  const current = normalizeInventory(inventories[resolvedAccountId]);
  const existing = new Set(current[type] || []);
  existing.add(optionId);
  const nextInventory = {
    ...current,
    [type]: Array.from(existing)
  };
  writeAllInventories({
    ...inventories,
    [resolvedAccountId]: nextInventory
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('blackjackInventoryUpdate', {
        detail: { accountId: resolvedAccountId, inventory: nextInventory }
      })
    );
  }
  return nextInventory;
};

export const listOwnedBlackjackOptions = (accountId) => {
  const inventory = getBlackjackInventory(accountId);
  return Object.entries(inventory).flatMap(([type, values]) => {
    if (!Array.isArray(values)) return [];
    const labels = BLACKJACK_OPTION_LABELS[type] || {};
    return values.map((optionId) => ({
      type,
      optionId,
      label: labels[optionId] || optionId
    }));
  });
};

export const getDefaultBlackjackLoadout = () => [...BLACKJACK_DEFAULT_LOADOUT];

export const blackjackAccountId = resolveAccountId;
