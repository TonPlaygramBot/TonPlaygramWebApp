const STORAGE_KEY = 'poolRoyaleUnlocks';

export const DEFAULT_POOL_ROYALE_UNLOCKS = Object.freeze({
  finishes: ['charredTimber'],
  chromeColors: ['gold'],
  railMarkerColors: ['gold'],
  clothColors: ['freshGreen'],
  cueStyles: ['birch-frost']
});

function normalizeCategory(value = []) {
  if (!Array.isArray(value)) return [];
  const unique = new Set(value.filter((item) => typeof item === 'string' && item.trim().length));
  return Array.from(unique);
}

export function mergePoolRoyaleUnlocks(unlocks = {}) {
  const merged = {
    finishes: normalizeCategory(unlocks.finishes || DEFAULT_POOL_ROYALE_UNLOCKS.finishes),
    chromeColors: normalizeCategory(unlocks.chromeColors || DEFAULT_POOL_ROYALE_UNLOCKS.chromeColors),
    railMarkerColors: normalizeCategory(
      unlocks.railMarkerColors || DEFAULT_POOL_ROYALE_UNLOCKS.railMarkerColors
    ),
    clothColors: normalizeCategory(unlocks.clothColors || DEFAULT_POOL_ROYALE_UNLOCKS.clothColors),
    cueStyles: normalizeCategory(unlocks.cueStyles || DEFAULT_POOL_ROYALE_UNLOCKS.cueStyles)
  };

  for (const [key, defaults] of Object.entries(DEFAULT_POOL_ROYALE_UNLOCKS)) {
    for (const id of defaults) {
      if (!merged[key].includes(id)) merged[key].push(id);
    }
  }

  return merged;
}

export function loadPoolRoyaleUnlocks() {
  if (typeof window === 'undefined') return mergePoolRoyaleUnlocks();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return mergePoolRoyaleUnlocks();
    const parsed = JSON.parse(raw);
    return mergePoolRoyaleUnlocks(parsed);
  } catch (err) {
    console.warn('Failed to load Pool Royale unlocks', err);
    return mergePoolRoyaleUnlocks();
  }
}

export function savePoolRoyaleUnlocks(unlocks) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mergePoolRoyaleUnlocks(unlocks)));
  } catch (err) {
    console.warn('Failed to save Pool Royale unlocks', err);
  }
}

export function hasPoolRoyaleUnlock(unlocks, category, id) {
  if (!id || !category) return false;
  const merged = mergePoolRoyaleUnlocks(unlocks);
  return merged[category]?.includes(id) || false;
}

export function grantPoolRoyaleUnlock(unlocks, category, id) {
  if (!category || !id) return mergePoolRoyaleUnlocks(unlocks);
  const merged = mergePoolRoyaleUnlocks(unlocks);
  if (!merged[category]) {
    merged[category] = [];
  }
  if (!merged[category].includes(id)) {
    merged[category] = [...merged[category], id];
  }
  return mergePoolRoyaleUnlocks(merged);
}

export function getPoolRoyaleStorageKey() {
  return STORAGE_KEY;
}
