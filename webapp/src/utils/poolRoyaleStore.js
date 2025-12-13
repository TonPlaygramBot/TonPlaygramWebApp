const STORAGE_KEY = 'poolRoyaleOwnedItems';
export const POOL_ROYALE_INVENTORY_EVENT = 'poolRoyaleInventoryUpdated';

export const POOL_ROYALE_OPTION_TYPES = Object.freeze({
  finish: 'finish',
  chrome: 'chrome',
  cloth: 'cloth',
  railMarkerColor: 'railMarkerColor',
  railMarkerShape: 'railMarkerShape',
  cue: 'cue'
});

const freeItems = [
  {
    id: `${POOL_ROYALE_OPTION_TYPES.finish}:charredTimber`,
    name: 'Charred Timber Finish',
    description: 'Default Pool Royale wood finish (non-tradable).'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.chrome}:gold`,
    name: 'Gold Chrome Plates',
    description: 'Gold fascia plates default for every table.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.railMarkerColor}:gold`,
    name: 'Gold Rail Diamonds',
    description: 'Diamond markers set to gold by default.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.railMarkerShape}:diamond`,
    name: 'Diamond Rail Shape',
    description: 'Default diamond rail markers.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.cloth}:freshGreen`,
    name: 'Tour Green Cloth',
    description: 'Tour green felt is free for everyone.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.cue}:birch-frost`,
    name: 'Birch Frost Cue',
    description: 'Starter cue finish (non-tradable).'
  }
];

export const POOL_ROYALE_STORE_ITEMS = [
  {
    id: `${POOL_ROYALE_OPTION_TYPES.finish}:rusticSplit`,
    name: 'Rustic Split Finish',
    priceTPC: 4200,
    category: 'Table Finish',
    description: 'Brushed rustic rails and fascia as a collectible NFT.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.finish}:plankStudio`,
    name: 'Plank Studio Finish',
    priceTPC: 4800,
    category: 'Table Finish',
    description: 'Studio plank aesthetic with warm trim.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.finish}:weatheredGrey`,
    name: 'Weathered Grey Finish',
    priceTPC: 5200,
    category: 'Table Finish',
    description: 'Storm-worn grey rails and fascia.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.finish}:jetBlackCarbon`,
    name: 'Jet Black Carbon Fibre',
    priceTPC: 6200,
    category: 'Table Finish',
    description: 'Matte carbon fibre body with metallic trim.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.chrome}:chrome`,
    name: 'Chrome Plates',
    priceTPC: 2600,
    category: 'Chrome Fascia',
    description: 'Swap fascia plates back to polished chrome.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.railMarkerColor}:chrome`,
    name: 'Chrome Diamonds',
    priceTPC: 1800,
    category: 'Rail Markers',
    description: 'Diamond markers with chrome sparkle.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.railMarkerColor}:pearl`,
    name: 'Pearl Diamonds',
    priceTPC: 2100,
    category: 'Rail Markers',
    description: 'Pearlescent rail markers for a softer glow.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.railMarkerShape}:circle`,
    name: 'Circular Markers',
    priceTPC: 1500,
    category: 'Rail Markers',
    description: 'Circle marker set for the rails.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.cloth}:graphite`,
    name: 'Arcadia Graphite Cloth',
    priceTPC: 3500,
    category: 'Cloth',
    description: 'Deep graphite felt with subdued sheen.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.cloth}:arcticBlue`,
    name: 'Arctic Blue Cloth',
    priceTPC: 3400,
    category: 'Cloth',
    description: 'Cool blue tournament-ready felt.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.cue}:redwood-ember`,
    name: 'Redwood Ember Cue',
    priceTPC: 1200,
    category: 'Cue Styles',
    description: 'Warm redwood grain with ember contrast.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.cue}:wenge-nightfall`,
    name: 'Wenge Nightfall Cue',
    priceTPC: 1400,
    category: 'Cue Styles',
    description: 'Dark wenge finish with high contrast.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.cue}:mahogany-heritage`,
    name: 'Mahogany Heritage Cue',
    priceTPC: 1550,
    category: 'Cue Styles',
    description: 'Classic mahogany tones for traditionalists.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.cue}:walnut-satin`,
    name: 'Walnut Satin Cue',
    priceTPC: 1650,
    category: 'Cue Styles',
    description: 'Balanced walnut finish with satin sheen.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.cue}:carbon-matrix`,
    name: 'Carbon Matrix Cue',
    priceTPC: 1900,
    category: 'Cue Styles',
    description: 'Technical carbon fibre weave with gloss highlights.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.cue}:maple-horizon`,
    name: 'Maple Horizon Cue',
    priceTPC: 1750,
    category: 'Cue Styles',
    description: 'Light maple with airy highlight balance.'
  },
  {
    id: `${POOL_ROYALE_OPTION_TYPES.cue}:graphite-aurora`,
    name: 'Graphite Aurora Cue',
    priceTPC: 1850,
    category: 'Cue Styles',
    description: 'Graphite fibre cue with aurora tint.'
  }
];

export const POOL_ROYALE_ITEM_CATALOG = [...freeItems, ...POOL_ROYALE_STORE_ITEMS];

const parseStoredItems = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse Pool Royale inventory', err);
    return [];
  }
};

const persistOwnedItems = (ids) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  window.dispatchEvent(
    new CustomEvent(POOL_ROYALE_INVENTORY_EVENT, { detail: [...ids] })
  );
};

export const toPoolRoyaleKey = (type, optionId) => `${type}:${optionId}`;

export const loadPoolRoyaleOwnedSet = () => {
  const stored = new Set(parseStoredItems());
  freeItems.forEach((item) => stored.add(item.id));
  return stored;
};

export const isPoolRoyaleOptionUnlocked = (type, optionId, ownedSet) => {
  const key = toPoolRoyaleKey(type, optionId);
  const set = ownedSet ?? loadPoolRoyaleOwnedSet();
  return set.has(key);
};

export const purchasePoolRoyaleItem = (itemId) => {
  const owned = loadPoolRoyaleOwnedSet();
  owned.add(itemId);
  persistOwnedItems(owned);
  return owned;
};

export const getPoolRoyaleItemMeta = (itemId) =>
  POOL_ROYALE_ITEM_CATALOG.find((item) => item.id === itemId) ?? null;

export const formatTPC = (amount) =>
  amount.toLocaleString('en-US', { maximumFractionDigits: 0 });

