import {
  DOMINO_DEFAULT_LOADOUT,
  DOMINO_DEFAULT_UNLOCKS,
  DOMINO_OPTION_LABELS
} from '../config/dominoInventoryConfig.js';

const STORAGE_KEY = 'dominoRoyalInventoryByAccount';

const copyDefaults = () =>
  Object.entries(DOMINO_DEFAULT_UNLOCKS).reduce((acc, [key, values]) => {
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
    console.warn('Failed to read domino inventory, resetting', err);
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

export const getDominoInventory = (accountId) => {
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

export const isDominoOptionUnlocked = (type, optionId, inventoryOrAccountId) => {
  if (!type || !optionId) return false;
  const inventory =
    typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId
      ? getDominoInventory(inventoryOrAccountId)
      : inventoryOrAccountId;
  return Array.isArray(inventory?.[type]) && inventory[type].includes(optionId);
};

export const addDominoUnlock = (type, optionId, accountId) => {
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
      new CustomEvent('dominoInventoryUpdate', {
        detail: { accountId: resolvedAccountId, inventory: nextInventory }
      })
    );
  }
  return nextInventory;
};

export const listOwnedDominoOptions = (accountId) => {
  const inventory = getDominoInventory(accountId);
  return Object.entries(inventory).flatMap(([type, values]) => {
    if (!Array.isArray(values)) return [];
    const labels = DOMINO_OPTION_LABELS[type] || {};
    return values.map((optionId) => ({
      type,
      optionId,
      label: labels[optionId] || optionId
    }));
  });
};

export const getDefaultDominoLoadout = () => [...DOMINO_DEFAULT_LOADOUT];

export const dominoAccountId = resolveAccountId;
