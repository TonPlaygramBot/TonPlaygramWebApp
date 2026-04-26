import {
  BILARDO_SHQIP_DEFAULT_LOADOUT,
  BILARDO_SHQIP_DEFAULT_UNLOCKS,
  BILARDO_SHQIP_OPTION_LABELS
} from '../config/bilardoShqipInventoryConfig.js';

const STORAGE_KEY = 'bilardoShqipInventoryByAccount';

const copyDefaults = () =>
  Object.entries(BILARDO_SHQIP_DEFAULT_UNLOCKS).reduce((acc, [key, values]) => {
    acc[key] = Array.isArray(values) ? [...values] : [];
    return acc;
  }, {});

const sortUnique = (values) =>
  Array.from(new Set(Array.isArray(values) ? values : Array.from(values || [])))
    .filter(Boolean)
    .sort();

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
    console.warn('Failed to read Bilardo Shqip inventory, resetting', err);
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
    merged[key] = sortUnique([...(merged[key] || []), ...value]);
  });
  return merged;
};

const readCachedInventory = (accountId) => {
  const inventories = readAllInventories();
  const normalized = normalizeInventory(inventories[accountId]);
  if (typeof window !== 'undefined') {
    writeAllInventories({
      ...inventories,
      [accountId]: normalized
    });
  }
  return normalized;
};

const persistCache = (accountId, inventory) => {
  if (typeof window === 'undefined') return;
  const inventories = readAllInventories();
  const payload = {
    ...inventories,
    [accountId]: normalizeInventory(inventory)
  };
  writeAllInventories(payload);
};

export const bilardoShqipAccountId = (accountId) => resolveAccountId(accountId);

export const getBilardoShqipInventory = (accountId) =>
  readCachedInventory(resolveAccountId(accountId));

export const isBilardoShqipOptionUnlocked = (type, optionId, inventoryOrAccountId) => {
  if (!type || !optionId) return false;
  const inventory =
    typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId
      ? getBilardoShqipInventory(inventoryOrAccountId)
      : inventoryOrAccountId;
  return Array.isArray(inventory?.[type]) && inventory[type].includes(optionId);
};

export const addBilardoShqipUnlock = (type, optionId, accountId) => {
  const resolvedAccountId = resolveAccountId(accountId);
  const current = readCachedInventory(resolvedAccountId);
  const existing = new Set(current[type] || []);
  existing.add(optionId);
  const nextInventory = {
    ...current,
    [type]: sortUnique(existing)
  };
  persistCache(resolvedAccountId, nextInventory);
  return nextInventory;
};

export const listOwnedBilardoShqipOptions = (inventoryOrAccountId) => {
  const inventory =
    typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId
      ? getBilardoShqipInventory(inventoryOrAccountId)
      : normalizeInventory(inventoryOrAccountId);
  return Object.entries(inventory).flatMap(([type, values]) => {
    if (!Array.isArray(values)) return [];
    const labels = BILARDO_SHQIP_OPTION_LABELS[type] || {};
    return values.map((optionId) => ({
      type,
      optionId,
      label: labels[optionId] || optionId
    }));
  });
};

export const getDefaultBilardoShqipLoadout = () => [...BILARDO_SHQIP_DEFAULT_LOADOUT];
