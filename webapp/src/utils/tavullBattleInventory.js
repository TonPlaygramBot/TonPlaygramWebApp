import {
  TAVULL_BATTLE_DEFAULT_UNLOCKS,
  TAVULL_BATTLE_OPTION_LABELS
} from '../config/tavullBattleInventoryConfig.js';

const STORAGE_KEY = 'tavullBattleInventoryByAccount';

const readStore = () => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (err) {
    console.warn('Failed to read tavull inventory, resetting', err);
    return {};
  }
};

const writeStore = (payload) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to persist tavull inventory', err);
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

const resolveAccountId = (accountId) =>
  String(accountId || '').trim() || 'guest';

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
