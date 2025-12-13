const STORAGE_KEY = 'poolRoyaleOwnedItems';

export const POOL_ROYALE_DEFAULT_UNLOCKS = Object.freeze([
  'table-finish:charredTimber',
  'chrome:gold',
  'rail-marker-color:gold',
  'rail-marker-shape:diamond',
  'cloth:freshGreen',
  'cue-style:birch-frost'
]);

export function poolRoyaleItemKey(type, id) {
  return `${type}:${id}`;
}

export function loadPoolRoyaleOwnership() {
  const defaults = new Set(POOL_ROYALE_DEFAULT_UNLOCKS);
  if (typeof window === 'undefined') {
    return defaults;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return defaults;
  }
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      parsed.forEach((item) => {
        if (typeof item === 'string') {
          defaults.add(item);
        }
      });
    }
  } catch (err) {
    console.warn('Failed to read Pool Royale ownership from storage', err);
  }
  return defaults;
}

export function persistPoolRoyaleOwnership(set) {
  if (typeof window === 'undefined') return;
  const values = Array.from(set ?? []);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch (err) {
    console.warn('Failed to save Pool Royale ownership to storage', err);
  }
}

export function unlockPoolRoyaleItem(key) {
  const ownership = loadPoolRoyaleOwnership();
  ownership.add(key);
  persistPoolRoyaleOwnership(ownership);
  return ownership;
}

export function isPoolRoyaleItemOwned(ownership, key) {
  return ownership?.has?.(key);
}

const crownIcon = '👑';

export const POOL_ROYALE_STORE_SECTIONS = [
  {
    id: 'table-finish',
    title: 'Table Finishes',
    blurb: 'Upgrade the rails and legs with limited wood treatments.',
    items: [
      {
        id: 'rusticSplit',
        label: 'Rustic Split',
        description: 'Split-oak beams with a satin clearcoat for a lodge vibe.',
        price: '450 TPC',
        key: poolRoyaleItemKey('table-finish', 'rusticSplit')
      },
      {
        id: 'plankStudio',
        label: 'Plank Studio',
        description: 'Art-house planks with smoked edges and brass trims.',
        price: '620 TPC',
        key: poolRoyaleItemKey('table-finish', 'plankStudio')
      },
      {
        id: 'weatheredGrey',
        label: 'Weathered Grey',
        description: 'Matte grey oak with champagne metal trims.',
        price: '520 TPC',
        key: poolRoyaleItemKey('table-finish', 'weatheredGrey')
      },
      {
        id: 'jetBlackCarbon',
        label: `${crownIcon} Jet Black Carbon`,
        description: 'Carbon fibre finish with fiber sheen highlights.',
        price: '880 TPC',
        key: poolRoyaleItemKey('table-finish', 'jetBlackCarbon')
      }
    ]
  },
  {
    id: 'chrome',
    title: 'Chrome Plates',
    blurb: 'Swap the metal badge color for the rails and pockets.',
    items: [
      {
        id: 'chrome',
        label: 'Polished Chrome',
        description: 'Studio-polished chrome set against emerald rails.',
        price: '240 TPC',
        key: poolRoyaleItemKey('chrome', 'chrome')
      }
    ]
  },
  {
    id: 'cloth',
    title: 'Cloth Colors',
    blurb: 'Tournament-grade felts with unique weave and sheen.',
    items: [
      {
        id: 'graphite',
        label: 'Arcadia Graphite',
        description: 'Gunmetal felt with muted sparkle and darker rails.',
        price: '260 TPC',
        key: poolRoyaleItemKey('cloth', 'graphite')
      },
      {
        id: 'arcticBlue',
        label: 'Arctic Blue',
        description: 'Nordic blue cloth with bright ice highlights.',
        price: '260 TPC',
        key: poolRoyaleItemKey('cloth', 'arcticBlue')
      }
    ]
  },
  {
    id: 'rail-markers',
    title: 'Rail Markers',
    blurb: 'Swap in premium sights and metals for precision aiming.',
    items: [
      {
        id: 'circle',
        label: 'Circle Sights',
        description: 'Minimal circular sights for a modern broadcast look.',
        price: '140 TPC',
        key: poolRoyaleItemKey('rail-marker-shape', 'circle')
      },
      {
        id: 'chrome',
        label: 'Chrome Markers',
        description: 'High-reflectivity chrome markers to match the rails.',
        price: '110 TPC',
        key: poolRoyaleItemKey('rail-marker-color', 'chrome')
      },
      {
        id: 'pearl',
        label: 'Pearl Markers',
        description: 'Mother-of-pearl inlays with a subtle satin sheen.',
        price: '110 TPC',
        key: poolRoyaleItemKey('rail-marker-color', 'pearl')
      }
    ]
  },
  {
    id: 'cue-style',
    title: 'Cue Styles',
    blurb: 'Collect cue butts and shafts with bespoke grains and fibers.',
    items: [
      {
        id: 'redwood-ember',
        label: 'Redwood Ember',
        description: 'Warm redwood grain with smoky ends.',
        price: '180 TPC',
        key: poolRoyaleItemKey('cue-style', 'redwood-ember')
      },
      {
        id: 'wenge-nightfall',
        label: 'Wenge Nightfall',
        description: 'Dark-stained wenge with strong contrast.',
        price: '210 TPC',
        key: poolRoyaleItemKey('cue-style', 'wenge-nightfall')
      },
      {
        id: 'mahogany-heritage',
        label: 'Mahogany Heritage',
        description: 'Classic mahogany with heritage gloss.',
        price: '200 TPC',
        key: poolRoyaleItemKey('cue-style', 'mahogany-heritage')
      },
      {
        id: 'walnut-satin',
        label: 'Walnut Satin',
        description: 'Balanced walnut tone for neutral builds.',
        price: '175 TPC',
        key: poolRoyaleItemKey('cue-style', 'walnut-satin')
      },
      {
        id: 'carbon-matrix',
        label: 'Carbon Matrix',
        description: 'Stealth carbon fibre with matte weave.',
        price: '240 TPC',
        key: poolRoyaleItemKey('cue-style', 'carbon-matrix')
      },
      {
        id: 'maple-horizon',
        label: 'Maple Horizon',
        description: 'Bright maple with airy contrast.',
        price: '170 TPC',
        key: poolRoyaleItemKey('cue-style', 'maple-horizon')
      },
      {
        id: 'graphite-aurora',
        label: 'Graphite Aurora',
        description: 'Midnight graphite with aurora accents.',
        price: '230 TPC',
        key: poolRoyaleItemKey('cue-style', 'graphite-aurora')
      }
    ]
  }
];
