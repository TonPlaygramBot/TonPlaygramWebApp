import { BOWLING_DEFAULT_LOADOUT } from '../config/bowlingInventoryConfig.js';

export const bowlingAccountId = (accountId = 'guest') => String(accountId || 'guest');
const keyFor = (accountId) => `tonplay.bowling.inventory.${bowlingAccountId(accountId)}`;

const base = () => ({ environmentHdri: [...BOWLING_DEFAULT_LOADOUT] });

export const getBowlingInventory = (accountId) => {
  if (typeof window === 'undefined') return base();
  try {
    const raw = window.localStorage.getItem(keyFor(accountId));
    if (!raw) return base();
    const parsed = JSON.parse(raw);
    return { ...base(), ...parsed };
  } catch {
    return base();
  }
};

const save = (accountId, inventory) => {
  if (typeof window === 'undefined') return inventory;
  window.localStorage.setItem(keyFor(accountId), JSON.stringify(inventory));
  return inventory;
};

export const isBowlingOptionUnlocked = (type, optionId, inventoryOrAccountId) => {
  const inv = typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId ? getBowlingInventory(inventoryOrAccountId) : inventoryOrAccountId;
  return Array.isArray(inv?.[type]) && inv[type].includes(optionId);
};

export const addBowlingUnlock = (type, optionId, accountId) => {
  const inv = getBowlingInventory(accountId);
  const next = { ...inv, [type]: Array.from(new Set([...(inv[type] || []), optionId])) };
  return Promise.resolve(save(accountId, next));
};
