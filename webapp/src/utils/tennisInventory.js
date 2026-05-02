import { ensureAccountId } from './telegram.js';

const STORAGE_KEY = 'tp_tennis_inventory_v1';

const readStore = () => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeStore = (payload) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
};

export const tennisAccountId = (accountId) =>
  accountId ||
  (typeof window !== 'undefined' ? window.localStorage.getItem('accountId') : null) ||
  ensureAccountId();

export const getTennisInventory = (accountId) => {
  const id = tennisAccountId(accountId);
  const all = readStore();
  return all[id] || {};
};

export const isTennisOptionUnlocked = (type, optionId, inventoryOrAccountId) => {
  const inventory =
    typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId
      ? getTennisInventory(inventoryOrAccountId)
      : inventoryOrAccountId;
  return Array.isArray(inventory?.[type]) && inventory[type].includes(optionId);
};

export const addTennisUnlock = (type, optionId, accountId) => {
  const id = tennisAccountId(accountId);
  const payload = readStore();
  const inventory = payload[id] || {};
  const owned = new Set(Array.isArray(inventory[type]) ? inventory[type] : []);
  owned.add(optionId);
  const nextInventory = { ...inventory, [type]: Array.from(owned) };
  payload[id] = nextInventory;
  writeStore(payload);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tennisInventoryUpdate', { detail: { accountId: id, inventory: nextInventory } })
    );
  }
  return nextInventory;
};
