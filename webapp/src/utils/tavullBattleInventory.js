import {
  TAVULL_BATTLE_DEFAULT_UNLOCKS,
  TAVULL_BATTLE_OPTION_LABELS
} from '../config/tavullBattleInventoryConfig.js';

const STORAGE_KEY = 'tavullBattleInventoryByAccount';
let memoryInventories = {};
let storageHealthy = true;

const readStore = () => {
  if (typeof window === 'undefined' || !storageHealthy) return memoryInventories;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    memoryInventories = parsed && typeof parsed === 'object' ? parsed : {};
    storageHealthy = true;
  } catch (err) {
    if (storageHealthy) {
      console.warn('Failed to read tavull inventory, using in-memory cache', err);
      storageHealthy = false;
    }
  }
  return memoryInventories;
};

const writeStore = (payload) => {
  memoryInventories = payload && typeof payload === 'object' ? payload : {};
  if (typeof window === 'undefined') return;
  if (!storageHealthy) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryInventories));
  } catch (err) {
    storageHealthy = false;
    console.warn('Failed to persist tavull inventory, caching in memory only', err);
  }
};

const normalizeInventory = (rawInventory) => {
  const base = Object.fromEntries(
    Object.entries(TAVULL_BATTLE_DEFAULT_UNLOCKS).map(([key, value]) => [
      key,
      [...new Set(value.filter(Boolean))]
    ])
  );
  if (!rawInventory || typeof rawInventory !== 'object') return base;
  Object.entries(rawInventory).forEach(([key, value]) => {
    if (!Array.isArray(value) || !base[key]) return;
    base[key] = [...new Set([...base[key], ...value.filter(Boolean)])];
  });
  return base;
};

const resolveAccountId = (accountId) => {
  const explicit = String(accountId || '').trim();
  if (explicit) return explicit;
  if (typeof window !== 'undefined' && storageHealthy) {
    try {
      const localAccountId = window.localStorage.getItem('accountId');
      if (localAccountId) return localAccountId;
    } catch (err) {
      if (storageHealthy) {
        console.warn(
          'Tavull inventory account lookup failed, falling back to guest',
          err
        );
        storageHealthy = false;
      }
    }
  }
  return 'guest';
};

export const getTavullBattleInventory = (accountId) => {
  const resolvedAccountId = resolveAccountId(accountId);
  const inventories = readStore();
  const normalized = normalizeInventory(inventories[resolvedAccountId]);
  inventories[resolvedAccountId] = normalized;
  writeStore(inventories);
  return normalized;
};

export const isTavullOptionUnlocked = (
  type,
  optionId,
  inventoryOrAccountId
) => {
  const inventory =
    typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId
      ? getTavullBattleInventory(inventoryOrAccountId)
      : inventoryOrAccountId;
  return Array.isArray(inventory?.[type]) && inventory[type].includes(optionId);
};

export const addTavullBattleUnlock = (type, optionId, accountId) => {
  const resolvedAccountId = resolveAccountId(accountId);
  const inventories = readStore();
  const current = normalizeInventory(inventories[resolvedAccountId]);
  const nextValues = new Set(current[type] || []);
  nextValues.add(optionId);
  const nextInventory = {
    ...current,
    [type]: [...nextValues]
  };
  const updated = {
    ...inventories,
    [resolvedAccountId]: nextInventory
  };
  writeStore(updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tavullBattleInventoryUpdate', {
        detail: { accountId: resolvedAccountId, inventory: nextInventory }
      })
    );
  }
  return nextInventory;
};

export const listOwnedTavullOptions = (accountId) => {
  const inventory = getTavullBattleInventory(accountId);
  return Object.entries(inventory).flatMap(([type, values]) => {
    const labels = TAVULL_BATTLE_OPTION_LABELS[type] || {};
    return values.map((optionId) => ({
      type,
      optionId,
      label: labels[optionId] || optionId
    }));
  });
};

export const tavullBattleAccountId = resolveAccountId;
