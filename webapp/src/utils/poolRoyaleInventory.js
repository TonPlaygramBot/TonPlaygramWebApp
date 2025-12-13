const STORAGE_KEY = 'poolRoyaleOwnedItems';

export const POOL_ROYALE_FREE_ITEMS = Object.freeze([
  'finish:charredTimber',
  'chrome:gold',
  'cloth:freshGreen',
  'cue:birch-frost',
  'marker:gold',
  'marker-shape:diamond'
]);

export const POOL_ROYALE_STORE_ITEMS = Object.freeze([
  {
    id: 'finish:charredTimber',
    name: 'Charred Timber Table',
    description: 'Baseline table finish included for every player.',
    priceTpc: 0,
    category: 'finish',
    optionId: 'charredTimber',
    tradable: false
  },
  {
    id: 'finish:rusticSplit',
    name: 'Rustic Split Finish',
    description: 'Warm studio wood treatment for the rails and frame.',
    priceTpc: 1800,
    category: 'finish',
    optionId: 'rusticSplit'
  },
  {
    id: 'finish:plankStudio',
    name: 'Plank Studio Finish',
    description: 'Cinematic honey oak planks with satin sheen.',
    priceTpc: 2100,
    category: 'finish',
    optionId: 'plankStudio'
  },
  {
    id: 'finish:weatheredGrey',
    name: 'Weathered Grey Finish',
    description: 'Smoked oak palette with brushed metal trim.',
    priceTpc: 2400,
    category: 'finish',
    optionId: 'weatheredGrey'
  },
  {
    id: 'finish:jetBlackCarbon',
    name: 'Jet Black Carbon',
    description: 'Matte carbon fibre rails with graphite sheen.',
    priceTpc: 3000,
    category: 'finish',
    optionId: 'jetBlackCarbon'
  },
  {
    id: 'chrome:gold',
    name: 'Gold Chrome Plates',
    description: 'Tournament spec gold fascia for every pocket.',
    priceTpc: 0,
    category: 'chrome',
    optionId: 'gold',
    tradable: false
  },
  {
    id: 'chrome:chrome',
    name: 'Polished Chrome Plates',
    description: 'Silver mirror finish on the pocket fascias.',
    priceTpc: 950,
    category: 'chrome',
    optionId: 'chrome'
  },
  {
    id: 'cloth:freshGreen',
    name: 'Tour Green Cloth',
    description: 'Official tour-grade green nap with lively bounce.',
    priceTpc: 0,
    category: 'cloth',
    optionId: 'freshGreen',
    tradable: false
  },
  {
    id: 'cloth:graphite',
    name: 'Arcadia Graphite Cloth',
    description: 'Dark graphite cloth with reduced sparkle.',
    priceTpc: 1300,
    category: 'cloth',
    optionId: 'graphite'
  },
  {
    id: 'cloth:arcticBlue',
    name: 'Arctic Blue Cloth',
    description: 'Cool ice-blue felt with crisp highlights.',
    priceTpc: 1500,
    category: 'cloth',
    optionId: 'arcticBlue'
  },
  {
    id: 'cue:birch-frost',
    name: 'Birch Frost Cue',
    description: 'Frosted birch shaft with pearl grain—standard issue.',
    priceTpc: 0,
    category: 'cue',
    optionId: 'birch-frost',
    tradable: false
  },
  {
    id: 'cue:redwood-ember',
    name: 'Redwood Ember Cue',
    description: 'Rich ember gradient on a redwood butt.',
    priceTpc: 1000,
    category: 'cue',
    optionId: 'redwood-ember'
  },
  {
    id: 'cue:wenge-nightfall',
    name: 'Wenge Nightfall Cue',
    description: 'Deep nightfall finish with high-contrast veins.',
    priceTpc: 1350,
    category: 'cue',
    optionId: 'wenge-nightfall'
  },
  {
    id: 'cue:mahogany-heritage',
    name: 'Mahogany Heritage Cue',
    description: 'Classic mahogany gloss with heritage rings.',
    priceTpc: 1600,
    category: 'cue',
    optionId: 'mahogany-heritage'
  },
  {
    id: 'cue:walnut-satin',
    name: 'Walnut Satin Cue',
    description: 'Balanced walnut satin sheen for control players.',
    priceTpc: 1500,
    category: 'cue',
    optionId: 'walnut-satin'
  },
  {
    id: 'cue:carbon-matrix',
    name: 'Carbon Matrix Cue',
    description: 'Technical carbon weave with metallic rings.',
    priceTpc: 1850,
    category: 'cue',
    optionId: 'carbon-matrix'
  },
  {
    id: 'cue:maple-horizon',
    name: 'Maple Horizon Cue',
    description: 'Bright maple cue with horizon fade.',
    priceTpc: 1200,
    category: 'cue',
    optionId: 'maple-horizon'
  },
  {
    id: 'cue:graphite-aurora',
    name: 'Graphite Aurora Cue',
    description: 'Graphite core with aurora tint for break shots.',
    priceTpc: 1900,
    category: 'cue',
    optionId: 'graphite-aurora'
  },
  {
    id: 'marker:gold',
    name: 'Gold Rail Diamonds',
    description: 'Default gold markers to match the chrome set.',
    priceTpc: 0,
    category: 'marker',
    optionId: 'gold',
    tradable: false
  },
  {
    id: 'marker:chrome',
    name: 'Chrome Rail Diamonds',
    description: 'Silver diamonds to match chrome fascias.',
    priceTpc: 600,
    category: 'marker',
    optionId: 'chrome'
  },
  {
    id: 'marker:pearl',
    name: 'Pearl Rail Diamonds',
    description: 'Pearl rail sights with soft sheen.',
    priceTpc: 850,
    category: 'marker',
    optionId: 'pearl'
  },
  {
    id: 'marker-shape:diamond',
    name: 'Diamond Markers',
    description: 'Standard diamond shape on the rails.',
    priceTpc: 0,
    category: 'marker-shape',
    optionId: 'diamond',
    tradable: false
  },
  {
    id: 'marker-shape:circle',
    name: 'Circle Markers',
    description: 'Alternate circular rail markers.',
    priceTpc: 700,
    category: 'marker-shape',
    optionId: 'circle'
  }
]);

export function makeInventoryKey(category, optionId) {
  return `${category}:${optionId}`;
}

function normalizeInventory(list = []) {
  const parsed = Array.isArray(list) ? list : [];
  const owned = new Set([...POOL_ROYALE_FREE_ITEMS]);
  parsed.forEach((id) => {
    if (typeof id === 'string') owned.add(id);
  });
  return owned;
}

export function loadPoolRoyaleInventory() {
  if (typeof window === 'undefined') return Array.from(POOL_ROYALE_FREE_ITEMS);
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.from(normalizeInventory(parsed));
  } catch {
    return Array.from(POOL_ROYALE_FREE_ITEMS);
  }
}

function persistInventory(ownedSet) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ownedSet)));
  } catch {}
}

export function purchasePoolRoyaleItem(itemId) {
  const owned = normalizeInventory(loadPoolRoyaleInventory());
  owned.add(itemId);
  persistInventory(owned);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('poolRoyaleInventoryChanged', { detail: { owned: Array.from(owned) } })
    );
  }
  return Array.from(owned);
}

export function isPoolRoyaleItemOwned(itemId, ownedSet) {
  const collection = ownedSet ? new Set(ownedSet) : normalizeInventory(loadPoolRoyaleInventory());
  return collection.has(itemId);
}

export function filterOwnedOptions(options, category, ownedSet) {
  const set = ownedSet ? new Set(ownedSet) : normalizeInventory(loadPoolRoyaleInventory());
  return options.filter((opt) => set.has(makeInventoryKey(category, opt.id)));
}

export function getOwnedPoolRoyaleItems(ownedSet) {
  return Array.from(ownedSet ? new Set(ownedSet) : normalizeInventory(loadPoolRoyaleInventory()));
}

export function getOwnedPoolRoyaleStoreItems(ownedSet) {
  const set = ownedSet ? new Set(ownedSet) : normalizeInventory(loadPoolRoyaleInventory());
  return POOL_ROYALE_STORE_ITEMS.filter((item) => set.has(item.id));
}
