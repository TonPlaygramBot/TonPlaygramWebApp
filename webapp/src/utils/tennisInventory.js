import {
  TENNIS_DEFAULT_LOADOUT,
  TENNIS_OPTION_LABELS
} from '../config/tennisInventoryConfig.js';

const STORAGE_KEY = 'tennisInventoryByAccount';

const copyDefaults = () =>
  Object.entries(TENNIS_DEFAULT_LOADOUT).reduce((acc, [key, values]) => {
    acc[key] = Array.isArray(values) ? [...values] : [];
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
  } catch {
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

export const getTennisInventory = (accountId) => {
  const resolvedAccountId = resolveAccountId(accountId);
  const inventories = readAllInventories();
  const normalized = normalizeInventory(inventories[resolvedAccountId]);
  writeAllInventories({ ...inventories, [resolvedAccountId]: normalized });
  return normalized;
};

export const isTennisOptionUnlocked = (type, optionId, inventoryOrAccountId) => {
  if (!type || !optionId) return false;
  const inventory =
    typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId
      ? getTennisInventory(inventoryOrAccountId)
      : inventoryOrAccountId;
  return Array.isArray(inventory?.[type]) && inventory[type].includes(optionId);
};

export const addTennisUnlock = (type, optionId, accountId) => {
  const resolvedAccountId = resolveAccountId(accountId);
  const inventories = readAllInventories();
  const current = normalizeInventory(inventories[resolvedAccountId]);
  const nextInventory = {
    ...current,
    [type]: Array.from(new Set([...(current[type] || []), optionId]))
  };
  writeAllInventories({ ...inventories, [resolvedAccountId]: nextInventory });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tennisInventoryUpdate', {
        detail: { accountId: resolvedAccountId, inventory: nextInventory }
      })
    );
  }
  return nextInventory;
};

export const listOwnedTennisOptions = (accountId) => {
  const inventory = getTennisInventory(accountId);
  return Object.entries(inventory).flatMap(([type, values]) => {
    if (!Array.isArray(values)) return [];
    const labels = TENNIS_OPTION_LABELS[type] || {};
    return values.map((optionId) => ({ type, optionId, label: labels[optionId] || optionId }));
  });
};

export const tennisAccountId = resolveAccountId;
