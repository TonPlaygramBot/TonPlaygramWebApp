import {
  POOL_ROYALE_DEFAULT_LOADOUT,
  POOL_ROYALE_DEFAULT_UNLOCKS,
  POOL_ROYALE_OPTION_LABELS
} from '../config/poolRoyaleInventoryConfig.js';
import {
  getPoolRoyalInventoryRemote,
  setPoolRoyalInventoryRemote
} from './api.js';

const STORAGE_KEY = 'poolRoyalInventoryByAccount';
const MIGRATION_KEY = 'poolRoyalInventoryMigrated';
const inflightSync = new Map();

const copyDefaults = () =>
  Object.entries(POOL_ROYALE_DEFAULT_UNLOCKS).reduce((acc, [key, values]) => {
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
    console.warn('Failed to read pool inventory, resetting', err);
    return {};
  }
};

const writeAllInventories = (payload) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const readMigrationFlags = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(MIGRATION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('Failed to read Pool Royale migration flags', err);
    return {};
  }
};

const writeMigrationFlags = (payload) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MIGRATION_KEY, JSON.stringify(payload));
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

const mergeInventories = (...inventories) => {
  const merged = copyDefaults();
  inventories
    .filter(Boolean)
    .forEach((inventory) => {
      const normalized = normalizeInventory(inventory);
      Object.entries(normalized).forEach(([key, values]) => {
        if (!Array.isArray(values)) return;
        merged[key] = sortUnique([...(merged[key] || []), ...values]);
      });
    });
  return merged;
};

const persistCache = (accountId, inventory, silent = false) => {
  if (typeof window === 'undefined') return;
  const inventories = readAllInventories();
  const payload = {
    ...inventories,
    [accountId]: normalizeInventory(inventory)
  };
  writeAllInventories(payload);
  if (!silent) {
    window.dispatchEvent(
      new CustomEvent('poolRoyalInventoryUpdate', {
        detail: { accountId, inventory: payload[accountId] }
      })
    );
  }
};

const markMigrated = (accountId) => {
  if (typeof window === 'undefined') return;
  const flags = readMigrationFlags();
  if (flags[accountId]) return;
  flags[accountId] = true;
  writeMigrationFlags(flags);
};

const isInventoryEmpty = (inventory) =>
  !inventory ||
  !Object.values(inventory).some((value) => Array.isArray(value) && value.length > 0);

const areInventoriesEqual = (a, b) => {
  const aKeys = Object.keys(a || {});
  const bKeys = Object.keys(b || {});
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) => Array.isArray(a[key]) && Array.isArray(b?.[key]) && a[key].join('|') === b[key].join('|')
  );
};

const syncWithServer = async (accountId, localInventory) => {
  if (!accountId || accountId === 'guest') return localInventory;
  const migrationFlags = readMigrationFlags();
  const skipMigration = Boolean(migrationFlags[accountId]);
  if (inflightSync.has(accountId)) {
    return inflightSync.get(accountId);
  }
  const promise = (async () => {
    const currentInventory = normalizeInventory(localInventory);
    let serverInventory = currentInventory;
    try {
      const remote = await getPoolRoyalInventoryRemote(accountId);
      if (remote?.error) throw new Error(remote.error);
      serverInventory = normalizeInventory(remote.inventory);
    } catch (err) {
      console.warn('Pool Royale inventory fetch failed, using cache', err);
      inflightSync.delete(accountId);
      return currentInventory;
    }

    const merged = mergeInventories(serverInventory, currentInventory);
    const needsPersist =
      (!skipMigration && !isInventoryEmpty(currentInventory)) ||
      !areInventoriesEqual(merged, serverInventory);

    let finalInventory = merged;
    if (needsPersist) {
      try {
        const saved = await setPoolRoyalInventoryRemote(accountId, merged);
        if (!saved?.error) {
          finalInventory = normalizeInventory(saved.inventory);
        }
      } catch (err) {
        console.warn('Pool Royale inventory save failed, keeping cache', err);
      }
    }

    markMigrated(accountId);
    if (!areInventoriesEqual(finalInventory, currentInventory)) {
      persistCache(accountId, finalInventory);
    } else {
      persistCache(accountId, finalInventory, true);
    }
    inflightSync.delete(accountId);
    return finalInventory;
  })();
  inflightSync.set(accountId, promise);
  return promise;
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

export const getPoolRoyalInventory = (accountId) => {
  const resolvedAccountId = resolveAccountId(accountId);
  const cached = readCachedInventory(resolvedAccountId);
  if (typeof window !== 'undefined') {
    syncWithServer(resolvedAccountId, cached);
  }
  return cached;
};

export const isPoolOptionUnlocked = (type, optionId, inventoryOrAccountId) => {
  if (!type || !optionId) return false;
  const inventory =
    typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId
      ? getPoolRoyalInventory(inventoryOrAccountId)
      : inventoryOrAccountId;
  return Array.isArray(inventory?.[type]) && inventory[type].includes(optionId);
};

export const addPoolRoyalUnlock = (type, optionId, accountId) => {
  const resolvedAccountId = resolveAccountId(accountId);
  const current = getPoolRoyalInventory(resolvedAccountId);
  const existing = new Set(current[type] || []);
  existing.add(optionId);
  const nextInventory = {
    ...current,
    [type]: sortUnique(existing)
  };
  persistCache(resolvedAccountId, nextInventory);
  if (typeof window !== 'undefined') {
    syncWithServer(resolvedAccountId, nextInventory);
  }
  return nextInventory;
};

export const listOwnedPoolRoyalOptions = (inventoryOrAccountId) => {
  const inventory =
    typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId
      ? getPoolRoyalInventory(inventoryOrAccountId)
      : normalizeInventory(inventoryOrAccountId);
  return Object.entries(inventory).flatMap(([type, values]) => {
    if (!Array.isArray(values)) return [];
    const labels = POOL_ROYALE_OPTION_LABELS[type] || {};
    return values.map((optionId) => ({
      type,
      optionId,
      label: labels[optionId] || optionId
    }));
  });
};

export const getDefaultPoolRoyalLoadout = () => [...POOL_ROYALE_DEFAULT_LOADOUT];

export const poolRoyalAccountId = resolveAccountId;
