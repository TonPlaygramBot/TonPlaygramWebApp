import { POOL_ROYALE_CLOTH_VARIANTS } from './poolRoyaleClothPresets.js';

export const POOL_ROYALE_HDRI_PRESETS = Object.freeze([
  {
    id: 'neonPhotostudio',
    assetId: 'neon_photostudio',
    name: 'Neon Photostudio',
    description: 'Vibrant studio glow with glossy cyan and magenta accents.',
    price: 1480,
    fallbackResolution: '4k',
    preferredResolutions: ['8k', '4k', '2k'],
    backgroundIntensity: 1.18,
    backgroundBlur: 0.18,
    exposure: 1.24
  },
  {
    id: 'studioSmall03',
    assetId: 'studio_small_03',
    name: 'Studio Small 03',
    description: 'Clean studio softbox with neutral tone for balanced play.',
    price: 1520,
    fallbackResolution: '4k',
    preferredResolutions: ['8k', '4k', '2k'],
    backgroundIntensity: 1.08,
    backgroundBlur: 0.16,
    exposure: 1.18
  },
  {
    id: 'studioSmall08',
    assetId: 'studio_small_08',
    name: 'Studio Small 08',
    description: 'Cool studio rim light with subtle green highlights.',
    price: 1540,
    fallbackResolution: '4k',
    preferredResolutions: ['8k', '4k', '2k'],
    backgroundIntensity: 1.1,
    backgroundBlur: 0.18,
    exposure: 1.2
  },
  {
    id: 'brownPhotostudio03',
    assetId: 'brown_photostudio_03',
    name: 'Bronze Studio',
    description: 'Warm bronze studio sweep with smooth specular rolloff.',
    price: 1560,
    fallbackResolution: '4k',
    preferredResolutions: ['8k', '4k', '2k'],
    backgroundIntensity: 1.14,
    backgroundBlur: 0.2,
    exposure: 1.22
  },
  {
    id: 'kiaraDawn',
    assetId: 'kiara_1_dawn',
    name: 'Kiara Dawn',
    description: 'Soft morning sky with golden hour diffusion.',
    price: 1600,
    fallbackResolution: '4k',
    preferredResolutions: ['8k', '4k', '2k'],
    backgroundIntensity: 1.06,
    backgroundBlur: 0.14,
    exposure: 1.16
  },
  {
    id: 'shanghaiBund',
    assetId: 'shanghai_bund',
    name: 'Shanghai Bund',
    description: 'City waterfront nightscape with neon reflections.',
    price: 1650,
    fallbackResolution: '4k',
    preferredResolutions: ['8k', '4k', '2k'],
    backgroundIntensity: 1.24,
    backgroundBlur: 0.22,
    exposure: 1.3
  },
  {
    id: 'veniceSunset',
    assetId: 'venice_sunset',
    name: 'Venice Sunset',
    description: 'Warm lagoon horizon with deep orange skies.',
    price: 1620,
    fallbackResolution: '4k',
    preferredResolutions: ['8k', '4k', '2k'],
    backgroundIntensity: 1.12,
    backgroundBlur: 0.2,
    exposure: 1.24
  },
  {
    id: 'emptyWarehouse',
    assetId: 'empty_warehouse_01',
    name: 'Warehouse Loft',
    description: 'Industrial loft ambience with soft skylight wrap.',
    price: 1580,
    fallbackResolution: '4k',
    preferredResolutions: ['8k', '4k', '2k'],
    backgroundIntensity: 1.05,
    backgroundBlur: 0.17,
    exposure: 1.18
  },
  {
    id: 'adamsBridge',
    assetId: 'adams_place_bridge',
    name: 'Adams Place Bridge',
    description: 'Modern bridge canopy with cool skylight gradients.',
    price: 1680,
    fallbackResolution: '4k',
    preferredResolutions: ['8k', '4k', '2k'],
    backgroundIntensity: 1.08,
    backgroundBlur: 0.16,
    exposure: 1.2
  },
  {
    id: 'kloofendal',
    assetId: 'kloofendal_48d_partly_cloudy',
    name: 'Kloofendal Midday',
    description: 'Bright outdoor HDRI with crisp shadows and blue skies.',
    price: 1700,
    fallbackResolution: '4k',
    preferredResolutions: ['8k', '4k', '2k'],
    backgroundIntensity: 1.16,
    backgroundBlur: 0.12,
    exposure: 1.28
  }
]);

export const POOL_ROYALE_DEFAULT_HDRI_ID = POOL_ROYALE_HDRI_PRESETS[0].id;

export const POOL_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableFinish: ['charredTimber'],
  chromeColor: ['gold'],
  railMarkerColor: ['gold'],
  clothColor: [POOL_ROYALE_CLOTH_VARIANTS[0].id],
  cueStyle: ['birch-frost'],
  pocketLiner: ['blackPocket'],
  environmentHdri: [POOL_ROYALE_DEFAULT_HDRI_ID]
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
  POOL_ROYALE_CLOTH_VARIANTS.reduce((acc, variant) => {
    acc[variant.id] = variant.name;
    return acc;
  }, {})
  ),
  environmentHdri: Object.freeze(
    POOL_ROYALE_HDRI_PRESETS.reduce((acc, preset) => {
      acc[preset.id] = preset.name;
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
  ...POOL_ROYALE_CLOTH_VARIANTS.map((variant) => ({
    id: `cloth-${variant.id}`,
    type: 'clothColor',
    optionId: variant.id,
    name: variant.name,
    price: variant.price,
    description: variant.description
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
  },
  ...POOL_ROYALE_HDRI_PRESETS.map((preset) => ({
    id: `hdri-${preset.id}`,
    type: 'environmentHdri',
    optionId: preset.id,
    name: `${preset.name} HDRI`,
    price: preset.price,
    description: preset.description
  }))
];

export const POOL_ROYALE_DEFAULT_LOADOUT = [
  { type: 'tableFinish', optionId: 'charredTimber', label: 'Charred Timber Finish' },
  { type: 'chromeColor', optionId: 'gold', label: 'Gold Chrome Plates' },
  { type: 'railMarkerColor', optionId: 'gold', label: 'Gold Diamond Markers' },
  {
    type: 'clothColor',
    optionId: POOL_ROYALE_CLOTH_VARIANTS[0].id,
    label: POOL_ROYALE_CLOTH_VARIANTS[0].name
  },
  { type: 'cueStyle', optionId: 'birch-frost', label: 'Birch Frost Cue' },
  { type: 'pocketLiner', optionId: 'blackPocket', label: 'Black Pocket Jaws' },
  {
    type: 'environmentHdri',
    optionId: POOL_ROYALE_DEFAULT_HDRI_ID,
    label: POOL_ROYALE_HDRI_PRESETS[0].name
  }
];
