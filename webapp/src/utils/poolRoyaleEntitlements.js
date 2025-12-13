export const POOL_ROYALE_OWNERSHIP_STORAGE_KEY = 'poolRoyaleOwnedItems';

export const DEFAULT_POOL_ROYALE_OWNERSHIP = Object.freeze({
  tableFinish: Object.freeze(['charredTimber']),
  chromeColor: Object.freeze(['gold']),
  clothColor: Object.freeze(['freshGreen']),
  railMarkerColor: Object.freeze(['gold']),
  railMarkerShape: Object.freeze(['diamond']),
  cueStyle: Object.freeze(['birch-frost'])
});

const normalizeIds = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
};

const createOwnership = (raw = {}) => {
  const merged = {};
  for (const key of Object.keys(DEFAULT_POOL_ROYALE_OWNERSHIP)) {
    const baseline = Array.from(DEFAULT_POOL_ROYALE_OWNERSHIP[key]);
    const extras = normalizeIds(raw?.[key]);
    merged[key] = Array.from(new Set([...baseline, ...extras]));
  }
  return merged;
};

export function mergePoolRoyaleOwnership(raw) {
  return createOwnership(raw);
}

export function loadPoolRoyaleOwnership() {
  if (typeof window === 'undefined') {
    return createOwnership();
  }
  try {
    const stored = window.localStorage.getItem(POOL_ROYALE_OWNERSHIP_STORAGE_KEY);
    if (!stored) return createOwnership();
    const parsed = JSON.parse(stored);
    return createOwnership(parsed);
  } catch (err) {
    console.warn('Failed to load Pool Royale ownership', err);
    return createOwnership();
  }
}

export function persistPoolRoyaleOwnership(nextOwnership) {
  if (typeof window === 'undefined') {
    return createOwnership(nextOwnership);
  }
  const merged = createOwnership(nextOwnership);
  try {
    window.localStorage.setItem(
      POOL_ROYALE_OWNERSHIP_STORAGE_KEY,
      JSON.stringify(merged)
    );
  } catch (err) {
    console.warn('Failed to persist Pool Royale ownership', err);
  }
  return merged;
}

export function filterOwnedOptions(options, type, ownership) {
  const owned = new Set((ownership?.[type] ?? DEFAULT_POOL_ROYALE_OWNERSHIP[type]) || []);
  return options.filter((option) => owned.has(option.id));
}

export function hasPoolRoyaleOwnership(type, id, ownership) {
  if (!id || !type) return false;
  const ownedList = ownership?.[type] ?? DEFAULT_POOL_ROYALE_OWNERSHIP[type];
  return Array.isArray(ownedList) && ownedList.includes(id);
}
