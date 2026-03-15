import {
  CHECKERS_BATTLE_DEFAULT_LOADOUT,
  CHECKERS_BATTLE_DEFAULT_UNLOCKS,
  CHECKERS_BATTLE_OPTION_LABELS
} from '../config/checkersBattleInventoryConfig.js';

const STORAGE_KEY = 'checkersBattleInventoryByAccount';
let memoryInventories = {};
let storageHealthy = true;

const copyDefaults = () =>
  Object.entries(CHECKERS_BATTLE_DEFAULT_UNLOCKS).reduce((acc, [key, values]) => {
    acc[key] = Array.isArray(values) ? [...values].filter(Boolean) : [];
    return acc;
  }, {});

const resolveAccountId = (accountId) => {
  if (accountId) return accountId;
  if (typeof window !== 'undefined' && storageHealthy) {
    try {
      const stored = window.localStorage.getItem('accountId');
      if (stored) return stored;
    } catch (err) {
      if (storageHealthy) {
        console.warn('Checkers inventory storage unavailable, falling back to guest account', err);
        storageHealthy = false;
      }
    }
  }
  return 'guest';
};

const readAllInventories = () => {
  if (typeof window === 'undefined' || !storageHealthy) return memoryInventories;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    memoryInventories = raw ? JSON.parse(raw) : {};
    storageHealthy = true;
  } catch (err) {
    if (storageHealthy) {
      console.warn('Failed to read checkers inventory, using in-memory cache', err);
      storageHealthy = false;
    }
  }
  return memoryInventories;
};

const writeAllInventories = (payload) => {
  memoryInventories = payload || {};
  if (typeof window === 'undefined') return;
  if (!storageHealthy) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryInventories));
  } catch (err) {
    storageHealthy = false;
    console.warn('Failed to persist checkers inventory, caching in memory only', err);
  }
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

export const getCheckersBattleInventory = (accountId) => {
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

export const isCheckersOptionUnlocked = (type, optionId, inventoryOrAccountId) => {
  if (!type || !optionId) return false;
  const inventory =
    typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId
      ? getCheckersBattleInventory(inventoryOrAccountId)
      : inventoryOrAccountId;
  return Array.isArray(inventory?.[type]) && inventory[type].includes(optionId);
};

export const addCheckersBattleUnlock = (type, optionId, accountId) => {
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
      new CustomEvent('checkersBattleInventoryUpdate', {
        detail: { accountId: resolvedAccountId, inventory: nextInventory }
      })
    );
  }
  return nextInventory;
};

export const listOwnedCheckersOptions = (accountId) => {
  const inventory = getCheckersBattleInventory(accountId);
  return Object.entries(inventory).flatMap(([type, values]) => {
    if (!Array.isArray(values)) return [];
    const labels = CHECKERS_BATTLE_OPTION_LABELS[type] || {};
    return values.map((optionId) => ({
      type,
      optionId,
      label: labels[optionId] || optionId
    }));
  });
};

export const getDefaultCheckersBattleLoadout = () => [...CHECKERS_BATTLE_DEFAULT_LOADOUT];

export const checkersBattleAccountId = resolveAccountId;
