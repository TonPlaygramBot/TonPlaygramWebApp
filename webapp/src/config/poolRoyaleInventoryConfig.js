export const POOL_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableFinish: ['charredTimber'],
  chromeColor: ['gold'],
  railMarkerColor: ['gold'],
  clothColor: ['freshGreen'],
  cueStyle: ['birch-frost']
});

export const POOL_ROYALE_OPTION_LABELS = Object.freeze({
  tableFinish: Object.freeze({
    rusticSplit: 'Pearl Cream',
    charredTimber: 'Charred Timber',
    plankStudio: 'Plank Studio',
    weatheredGrey: 'Weathered Grey',
    jetBlackCarbon: 'Jet Black Carbon'
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
  clothColor: Object.freeze({
    freshGreen: 'Tour Green',
    graphite: 'Arcadia Graphite',
    arcticBlue: 'Arctic Blue',
    emeraldPulse: 'Emerald Pulse',
    ivyDrift: 'Ivy Drift',
    mintRadiance: 'Mint Radiance',
    cobaltFrost: 'Cobalt Frost',
    midnightWave: 'Midnight Wave',
    neonAzure: 'Neon Azure'
  }),
  cueStyle: Object.freeze({
    'redwood-ember': 'Redwood Ember',
    'birch-frost': 'Birch Frost',
    'wenge-nightfall': 'Wenge Nightfall',
    'mahogany-heritage': 'Mahogany Heritage',
    'walnut-satin': 'Walnut Satin',
    'carbon-matrix': 'Carbon Matrix',
    'maple-horizon': 'Maple Horizon',
    'graphite-aurora': 'Graphite Aurora'
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
  {
    id: 'cloth-graphite',
    type: 'clothColor',
    optionId: 'graphite',
    name: 'Arcadia Graphite Cloth',
    price: 520,
    description: 'Tournament graphite cloth for a darker arena feel.'
  },
  {
    id: 'cloth-arcticBlue',
    type: 'clothColor',
    optionId: 'arcticBlue',
    name: 'Arctic Blue Cloth',
    price: 560,
    description: 'Cool arctic blue tournament cloth with crisp sheen.'
  },
  {
    id: 'cloth-emeraldPulse',
    type: 'clothColor',
    optionId: 'emeraldPulse',
    name: 'Emerald Pulse Cloth',
    price: 590,
    description: 'Glowing emerald cloth with a pulsing luxe nap.'
  },
  {
    id: 'cloth-ivyDrift',
    type: 'clothColor',
    optionId: 'ivyDrift',
    name: 'Ivy Drift Cloth',
    price: 610,
    description: 'Deep ivy cloth with shaded railside gradients.'
  },
  {
    id: 'cloth-mintRadiance',
    type: 'clothColor',
    optionId: 'mintRadiance',
    name: 'Mint Radiance Cloth',
    price: 620,
    description: 'Bright mint cloth that lifts ambient highlights.'
  },
  {
    id: 'cloth-cobaltFrost',
    type: 'clothColor',
    optionId: 'cobaltFrost',
    name: 'Cobalt Frost Cloth',
    price: 630,
    description: 'Frosted cobalt cloth with crisp cool reflections.'
  },
  {
    id: 'cloth-midnightWave',
    type: 'clothColor',
    optionId: 'midnightWave',
    name: 'Midnight Wave Cloth',
    price: 640,
    description: 'Midnight navy cloth with wavey sapphire sheen.'
  },
  {
    id: 'cloth-neonAzure',
    type: 'clothColor',
    optionId: 'neonAzure',
    name: 'Neon Azure Cloth',
    price: 660,
    description: 'Electric azure cloth with high-contrast glow.'
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
  { type: 'clothColor', optionId: 'freshGreen', label: 'Tour Green Cloth' },
  { type: 'cueStyle', optionId: 'birch-frost', label: 'Birch Frost Cue' }
];
