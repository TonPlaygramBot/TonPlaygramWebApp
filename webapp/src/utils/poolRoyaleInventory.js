const STORAGE_KEY = 'poolRoyaleInventory';

export const POOL_ROYALE_BASE_UNLOCKS = Object.freeze({
  finishes: ['charredTimber'],
  chromeColors: ['gold'],
  clothColors: ['freshGreen'],
  cueStyles: ['birch-frost'],
  railMarkerColors: ['gold'],
  railMarkerShapes: ['diamond']
});

const CATEGORY_KEYS = Object.freeze({
  finishes: 'finishes',
  chromeColors: 'chromeColors',
  clothColors: 'clothColors',
  cueStyles: 'cueStyles',
  railMarkerColors: 'railMarkerColors',
  railMarkerShapes: 'railMarkerShapes'
});

const normalizeInventory = (raw = {}) => {
  const merged = {};
  Object.values(CATEGORY_KEYS).forEach((key) => {
    const baseItems = POOL_ROYALE_BASE_UNLOCKS[key] ?? [];
    const userItems = Array.isArray(raw[key]) ? raw[key] : [];
    merged[key] = new Set([...baseItems, ...userItems]);
  });
  return merged;
};

const serializeInventory = (inventory) => {
  const serialized = {};
  Object.values(CATEGORY_KEYS).forEach((key) => {
    const items = inventory?.[key];
    serialized[key] = Array.from(items instanceof Set ? items : []);
  });
  return serialized;
};

export const loadPoolRoyaleInventory = () => {
  if (typeof window === 'undefined') {
    return normalizeInventory();
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return normalizeInventory();
    const parsed = JSON.parse(stored);
    return normalizeInventory(parsed);
  } catch (err) {
    console.warn('Failed to load Pool Royale inventory', err);
    return normalizeInventory();
  }
};

export const savePoolRoyaleInventory = (inventory) => {
  if (typeof window === 'undefined') return inventory;
  try {
    const normalized = normalizeInventory(serializeInventory(inventory));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeInventory(normalized)));
    return normalized;
  } catch (err) {
    console.warn('Failed to save Pool Royale inventory', err);
    return inventory;
  }
};

export const grantPoolRoyaleUnlock = (category, id) => {
  if (!id || !CATEGORY_KEYS[category]) return loadPoolRoyaleInventory();
  const current = loadPoolRoyaleInventory();
  const next = normalizeInventory({
    ...serializeInventory(current),
    [category]: [...(current?.[category] ?? []), id]
  });
  return savePoolRoyaleInventory(next);
};

export const hasPoolRoyaleUnlock = (inventory, category, id) => {
  if (!id || !CATEGORY_KEYS[category]) return false;
  const set = inventory?.[category];
  return Boolean(set && set.has(id));
};

export const POOL_ROYALE_STORE_CATALOG = Object.freeze([
  {
    id: 'rusticSplit',
    category: CATEGORY_KEYS.finishes,
    label: 'Rustic Split Finish',
    description: 'Warm split-plank rails with mellow walnut cues.',
    price: '320 TON'
  },
  {
    id: 'plankStudio',
    category: CATEGORY_KEYS.finishes,
    label: 'Plank Studio Finish',
    description: 'Polished studio planks with satin brass trim.',
    price: '340 TON'
  },
  {
    id: 'weatheredGrey',
    category: CATEGORY_KEYS.finishes,
    label: 'Weathered Grey Finish',
    description: 'Frosted coastal grey frame with low-sheen rails.',
    price: '360 TON'
  },
  {
    id: 'jetBlackCarbon',
    category: CATEGORY_KEYS.finishes,
    label: 'Jet Black Carbon Finish',
    description: 'Stealth carbon rails with deep black fascia.',
    price: '380 TON'
  },
  {
    id: 'chrome',
    category: CATEGORY_KEYS.chromeColors,
    label: 'Chrome Plates',
    description: 'Mirror-polished chrome fascias for every pocket.',
    price: '240 TON'
  },
  {
    id: 'graphite',
    category: CATEGORY_KEYS.clothColors,
    label: 'Arcadia Graphite Cloth',
    description: 'Tournament graphite felt with subdued sheen.',
    price: '180 TON'
  },
  {
    id: 'arcticBlue',
    category: CATEGORY_KEYS.clothColors,
    label: 'Arctic Blue Cloth',
    description: 'Icy blue show-floor cloth with bright sparkles.',
    price: '180 TON'
  },
  {
    id: 'redwood-ember',
    category: CATEGORY_KEYS.cueStyles,
    label: 'Redwood Ember Cue',
    description: 'Deep ember cue butt with bright brass rings.',
    price: '95 TON'
  },
  {
    id: 'wenge-nightfall',
    category: CATEGORY_KEYS.cueStyles,
    label: 'Wenge Nightfall Cue',
    description: 'Dark wenge cue with sleek low-gloss finish.',
    price: '95 TON'
  },
  {
    id: 'mahogany-heritage',
    category: CATEGORY_KEYS.cueStyles,
    label: 'Mahogany Heritage Cue',
    description: 'Classic mahogany grain with vintage warmth.',
    price: '95 TON'
  },
  {
    id: 'walnut-satin',
    category: CATEGORY_KEYS.cueStyles,
    label: 'Walnut Satin Cue',
    description: 'Smooth walnut cue with satin highlights.',
    price: '95 TON'
  },
  {
    id: 'carbon-matrix',
    category: CATEGORY_KEYS.cueStyles,
    label: 'Carbon Matrix Cue',
    description: 'Carbon fiber pattern with modern contrast.',
    price: '125 TON'
  },
  {
    id: 'maple-horizon',
    category: CATEGORY_KEYS.cueStyles,
    label: 'Maple Horizon Cue',
    description: 'Bright maple cue with crisp Nordic tone.',
    price: '95 TON'
  },
  {
    id: 'graphite-aurora',
    category: CATEGORY_KEYS.cueStyles,
    label: 'Graphite Aurora Cue',
    description: 'Graphite fiber cue with subtle aurora tint.',
    price: '125 TON'
  },
  {
    id: 'chrome',
    category: CATEGORY_KEYS.railMarkerColors,
    label: 'Chrome Rail Diamonds',
    description: 'Chrome diamond markers to match silver plates.',
    price: '80 TON'
  },
  {
    id: 'pearl',
    category: CATEGORY_KEYS.railMarkerColors,
    label: 'Pearl Rail Diamonds',
    description: 'Soft pearl markers for luxe contrast.',
    price: '80 TON'
  },
  {
    id: 'circle',
    category: CATEGORY_KEYS.railMarkerShapes,
    label: 'Circle Rail Markers',
    description: 'Swap diamonds for circles on every rail.',
    price: '60 TON'
  }
]);

export { CATEGORY_KEYS as POOL_ROYALE_INVENTORY_KEYS, STORAGE_KEY as POOL_ROYALE_INVENTORY_STORAGE_KEY };
