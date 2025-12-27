import { POOL_ROYALE_CLOTH_PRESETS } from './poolRoyaleClothPresets.js';

const DEFAULT_CLOTH_OPTION = POOL_ROYALE_CLOTH_PRESETS[0]?.optionId || 'cabanMeadowGreen';

export const POOL_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableFinish: ['charredTimber'],
  chromeColor: ['gold'],
  railMarkerColor: ['gold'],
  clothColor: [DEFAULT_CLOTH_OPTION],
  cueStyle: ['birch-frost'],
  pocketLiner: ['blackPocket']
});

export const POOL_ROYALE_OPTION_LABELS = Object.freeze({
  tableFinish: Object.freeze({
    rusticSplit: 'Pearl Cream',
    charredTimber: 'Charred Timber',
    plankStudio: 'Plank Studio',
    weatheredGrey: 'Weathered Grey',
    jetBlackCarbon: 'Jet Black Carbon',
    frostedAsh: 'Frosted Ash',
    amberWharf: 'Amber Wharf',
    obsidianMist: 'Obsidian Mist'
  }),
  chromeColor: Object.freeze({
    chrome: 'Chrome',
    gold: 'Gold'
  }),
  railMarkerColor: Object.freeze({
    chrome: 'Chrome',
    pearl: 'Pearl',
    gold: 'Gold'
  }),
  clothColor: Object.freeze(
    POOL_ROYALE_CLOTH_PRESETS.reduce((acc, cloth) => {
      acc[cloth.optionId] = cloth.name;
      return acc;
    }, {})
  ),
  cueStyle: Object.freeze({
    'redwood-ember': 'Redwood Ember',
    'birch-frost': 'Birch Frost',
    'wenge-nightfall': 'Wenge Nightfall',
    'mahogany-heritage': 'Mahogany Heritage',
    'walnut-satin': 'Walnut Satin',
    'carbon-matrix': 'Carbon Matrix',
    'maple-horizon': 'Maple Horizon',
    'graphite-aurora': 'Graphite Aurora'
  }),
  pocketLiner: Object.freeze({
    blackPocket: 'Black Pocket Jaws',
    graphitePocket: 'Graphite Pocket Jaws',
    titaniumPocket: 'Titanium Pocket Jaws',
    copperPocket: 'Copper Pocket Jaws',
    emeraldPocket: 'Emerald Pocket Jaws',
    rubyPocket: 'Ruby Pocket Jaws',
    pearlPocket: 'Pearl Pocket Jaws'
  })
});

export const POOL_ROYALE_STORE_ITEMS = [
  {
    id: 'finish-rusticSplit',
    type: 'tableFinish',
    optionId: 'rusticSplit',
    name: 'Pearl Cream Finish',
    price: 820,
    description: 'Warm cream split rails with matching legs and trim.'
  },
  {
    id: 'finish-plankStudio',
    type: 'tableFinish',
    optionId: 'plankStudio',
    name: 'Plank Studio Finish',
    price: 910,
    description: 'Crisp plank-style oak studio rails with satin sheen.'
  },
  {
    id: 'finish-weatheredGrey',
    type: 'tableFinish',
    optionId: 'weatheredGrey',
    name: 'Weathered Grey Finish',
    price: 940,
    description: 'Driftwood grey rails with soft grain and cooled trim.'
  },
  {
    id: 'finish-jetBlack',
    type: 'tableFinish',
    optionId: 'jetBlackCarbon',
    name: 'Jet Black Carbon Finish',
    price: 1020,
    description: 'Carbon-inspired black rails with smoked metallic trim.'
  },
  {
    id: 'finish-frostedAsh',
    type: 'tableFinish',
    optionId: 'frostedAsh',
    name: 'Frosted Ash Finish',
    price: 980,
    description: 'Cool ash rails with satin silver trim and pale skirt.'
  },
  {
    id: 'finish-amberWharf',
    type: 'tableFinish',
    optionId: 'amberWharf',
    name: 'Amber Wharf Finish',
    price: 990,
    description: 'Warm amber planks with bronzed trim and deep grain.'
  },
  {
    id: 'finish-obsidianMist',
    type: 'tableFinish',
    optionId: 'obsidianMist',
    name: 'Obsidian Mist Finish',
    price: 1050,
    description: 'Smoked obsidian rails with misted graphite accents.'
  },
  {
    id: 'chrome-chrome',
    type: 'chromeColor',
    optionId: 'chrome',
    name: 'Mirror Chrome Fascias',
    price: 360,
    description: 'Polished chrome plates to swap in for the fascia set.'
  },
  {
    id: 'railMarkers-pearl',
    type: 'railMarkerColor',
    optionId: 'pearl',
    name: 'Pearl Diamonds',
    price: 280,
    description: 'Pearlescent diamond markers with soft sheen.'
  },
  {
    id: 'railMarkers-chrome',
    type: 'railMarkerColor',
    optionId: 'chrome',
    name: 'Chrome Diamonds',
    price: 240,
    description: 'Chrome-lined diamond markers that match fascia shine.'
  },
  ...POOL_ROYALE_CLOTH_PRESETS.map((cloth) => ({
    id: `cloth-${cloth.optionId}`,
    type: 'clothColor',
    optionId: cloth.optionId,
    name: cloth.name,
    price: cloth.price,
    description: cloth.description,
    swatches: cloth.swatches
  })),
  {
    id: 'pocket-graphite',
    type: 'pocketLiner',
    optionId: 'graphitePocket',
    name: 'Graphite Pocket Jaws',
    price: 520,
    description: 'Matte graphite jaws that mirror the fascia chrome glow.'
  },
  {
    id: 'pocket-titanium',
    type: 'pocketLiner',
    optionId: 'titaniumPocket',
    name: 'Titanium Pocket Jaws',
    price: 540,
    description: 'Cool titanium pocket liners with sharp metallic edges.'
  },
  {
    id: 'pocket-copper',
    type: 'pocketLiner',
    optionId: 'copperPocket',
    name: 'Copper Pocket Jaws',
    price: 560,
    description: 'Burnished copper jaws for a warm contrast to the cloth.'
  },
  {
    id: 'pocket-emerald',
    type: 'pocketLiner',
    optionId: 'emeraldPocket',
    name: 'Emerald Pocket Jaws',
    price: 580,
    description: 'Emerald-infused liners that blend with rich green felts.'
  },
  {
    id: 'pocket-ruby',
    type: 'pocketLiner',
    optionId: 'rubyPocket',
    name: 'Ruby Pocket Jaws',
    price: 590,
    description: 'Ruby-toned jaws with a subtle gloss for red cloth pairings.'
  },
  {
    id: 'pocket-pearl',
    type: 'pocketLiner',
    optionId: 'pearlPocket',
    name: 'Pearl Pocket Jaws',
    price: 600,
    description: 'Pearlescent pocket liners with soft highlights.'
  },
  {
    id: 'cue-redwood',
    type: 'cueStyle',
    optionId: 'redwood-ember',
    name: 'Redwood Ember Cue',
    price: 310,
    description: 'Rich redwood cue butt with ember accents.'
  },
  {
    id: 'cue-wenge',
    type: 'cueStyle',
    optionId: 'wenge-nightfall',
    name: 'Wenge Nightfall Cue',
    price: 340,
    description: 'Deep wenge finish with high-contrast stripes.'
  },
  {
    id: 'cue-mahogany',
    type: 'cueStyle',
    optionId: 'mahogany-heritage',
    name: 'Mahogany Heritage Cue',
    price: 325,
    description: 'Classic mahogany cue with heritage grain highlights.'
  },
  {
    id: 'cue-walnut',
    type: 'cueStyle',
    optionId: 'walnut-satin',
    name: 'Walnut Satin Cue',
    price: 295,
    description: 'Satin walnut cue butt with balanced contrast.'
  },
  {
    id: 'cue-carbon',
    type: 'cueStyle',
    optionId: 'carbon-matrix',
    name: 'Carbon Matrix Cue',
    price: 380,
    description: 'Carbon fiber cue with metallic weave highlights.'
  },
  {
    id: 'cue-maple',
    type: 'cueStyle',
    optionId: 'maple-horizon',
    name: 'Maple Horizon Cue',
    price: 300,
    description: 'Bright maple cue with horizon banding.'
  },
  {
    id: 'cue-graphite',
    type: 'cueStyle',
    optionId: 'graphite-aurora',
    name: 'Graphite Aurora Cue',
    price: 360,
    description: 'Graphite weave cue with aurora-inspired tint.'
  }
];

export const POOL_ROYALE_DEFAULT_LOADOUT = [
  { type: 'tableFinish', optionId: 'charredTimber', label: 'Charred Timber Finish' },
  { type: 'chromeColor', optionId: 'gold', label: 'Gold Chrome Plates' },
  { type: 'railMarkerColor', optionId: 'gold', label: 'Gold Diamond Markers' },
  {
    type: 'clothColor',
    optionId: DEFAULT_CLOTH_OPTION,
    label: POOL_ROYALE_CLOTH_PRESETS.find((c) => c.optionId === DEFAULT_CLOTH_OPTION)?.name || 'Caban Wool — Meadow Green'
  },
  { type: 'cueStyle', optionId: 'birch-frost', label: 'Birch Frost Cue' },
  { type: 'pocketLiner', optionId: 'blackPocket', label: 'Black Pocket Jaws' }
];
