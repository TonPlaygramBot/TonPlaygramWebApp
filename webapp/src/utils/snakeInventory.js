import {
  SNAKE_DEFAULT_LOADOUT,
  SNAKE_DEFAULT_UNLOCKS,
  SNAKE_OPTION_LABELS
} from '../config/snakeInventoryConfig.js';
import {
  resolveSnakeCaptureWeaponId,
  SNAKE_CAPTURE_WEAPON_OPTIONS
} from '../config/snakeWeaponCatalog.js';

const STORAGE_KEY = 'snakeInventoryByAccount';

const copyDefaults = () =>
  Object.entries(SNAKE_DEFAULT_UNLOCKS).reduce((acc, [key, values]) => {
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
  } catch (err) {
    console.warn('Failed to read snake inventory, resetting', err);
    return {};
  }
};

const writeAllInventories = (payload) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const KNOWN_CAPTURE_WEAPON_IDS = new Set(
  SNAKE_CAPTURE_WEAPON_OPTIONS.map((option) => resolveSnakeCaptureWeaponId(option.id)).filter(Boolean)
);

const normalizeInventoryValues = (key, values = []) => {
  if (key !== 'captureWeapon') return Array.from(new Set(values));
  return Array.from(
    new Set(
      values
        .map((value) => resolveSnakeCaptureWeaponId(value))
        .filter((value) => value && KNOWN_CAPTURE_WEAPON_IDS.has(value))
    )
  );
};

const normalizeInventory = (rawInventory) => {
  const base = copyDefaults();
  if (!rawInventory || typeof rawInventory !== 'object') return base;
  const merged = { ...base };
  Object.entries(rawInventory).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    merged[key] = normalizeInventoryValues(key, [...(merged[key] || []), ...value]);
  });
  return merged;
};

export const getSnakeInventory = (accountId) => {
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

export const isSnakeOptionUnlocked = (type, optionId, inventoryOrAccountId) => {
  if (!type || !optionId) return false;
  const inventory =
    typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId
      ? getSnakeInventory(inventoryOrAccountId)
      : inventoryOrAccountId;
  const resolvedOptionId = type === 'captureWeapon' ? resolveSnakeCaptureWeaponId(optionId) : optionId;
  return Array.isArray(inventory?.[type]) && inventory[type].includes(resolvedOptionId);
};

export const addSnakeUnlock = (type, optionId, accountId) => {
  const resolvedAccountId = resolveAccountId(accountId);
  const inventories = readAllInventories();
  const current = normalizeInventory(inventories[resolvedAccountId]);
  const existing = new Set(current[type] || []);
  existing.add(type === 'captureWeapon' ? resolveSnakeCaptureWeaponId(optionId) : optionId);
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
      new CustomEvent('snakeInventoryUpdate', {
        detail: { accountId: resolvedAccountId, inventory: nextInventory }
      })
    );
  }
  return nextInventory;
};

export const listOwnedSnakeOptions = (accountId) => {
  const inventory = getSnakeInventory(accountId);
  return Object.entries(inventory).flatMap(([type, values]) => {
    if (!Array.isArray(values)) return [];
    const labels = SNAKE_OPTION_LABELS[type] || {};
    return values.map((optionId) => ({
      type,
      optionId,
      label: labels[optionId] || optionId
    }));
  });
};

export const getDefaultSnakeLoadout = () => [...SNAKE_DEFAULT_LOADOUT];

export const snakeAccountId = resolveAccountId;

