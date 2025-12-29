import { POOL_ROYALE_CLOTH_VARIANTS } from './poolRoyaleClothPresets.js';

export const POOL_ROYALE_HDRI_VARIANTS = Object.freeze([
  {
    id: 'neonPhotostudio',
    name: 'Neon Photo Studio',
    assetId: 'neon_photostudio',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1420,
    exposure: 1.18,
    environmentIntensity: 1.12,
    backgroundIntensity: 1.06,
    swatches: ['#0ea5e9', '#8b5cf6'],
    description: 'Vibrant cyber studio wrap with strong rim accents.'
  },
  {
    id: 'studioSoftbox08',
    name: 'Studio Softbox 08',
    assetId: 'studio_small_08',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1460,
    exposure: 1.14,
    environmentIntensity: 1.04,
    backgroundIntensity: 1,
    swatches: ['#cbd5e1', '#94a3b8'],
    description: 'Neutral softbox studio with even wrap lighting.'
  },
  {
    id: 'bronzePhotostudio',
    name: 'Bronze Photo Loft',
    assetId: 'brown_photostudio_02',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1490,
    exposure: 1.16,
    environmentIntensity: 1.1,
    backgroundIntensity: 1.04,
    swatches: ['#f59e0b', '#b45309'],
    description: 'Warm loft studio with bronze-toned reflectors.'
  },
  {
    id: 'adamsBridge',
    name: 'Adams Bridge',
    assetId: 'adams_place_bridge',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1520,
    exposure: 1.12,
    environmentIntensity: 1.08,
    backgroundIntensity: 1.02,
    swatches: ['#1d4ed8', '#0ea5e9'],
    description: 'Cool twilight bridge lighting with crisp specular pickup.'
  },
  {
    id: 'veniceSunset',
    name: 'Venice Sunset',
    assetId: 'venice_sunset',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1550,
    exposure: 1.11,
    environmentIntensity: 1.14,
    backgroundIntensity: 1.06,
    swatches: ['#f59e0b', '#ef4444'],
    description: 'Golden-hour waterfront reflections with soft falloff.'
  },
  {
    id: 'modernRooftops',
    name: 'Modern Rooftops',
    assetId: 'modern_buildings',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1580,
    exposure: 1.1,
    environmentIntensity: 1.06,
    backgroundIntensity: 0.98,
    swatches: ['#22d3ee', '#0ea5e9'],
    description: 'Reflective skyline mix for sleek chrome highlights.'
  },
  {
    id: 'kloofendalClouds',
    name: 'Kloofendal Clouds',
    assetId: 'kloofendal_48d_partly_cloudy',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1610,
    exposure: 1.06,
    environmentIntensity: 1.02,
    backgroundIntensity: 0.96,
    swatches: ['#0ea5e9', '#22c55e'],
    description: 'Outdoor overcast balance for natural, even cloth response.'
  },
  {
    id: 'ballroomHall',
    name: 'Ballroom Hall',
    assetId: 'ballroom',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1640,
    exposure: 1.15,
    environmentIntensity: 1.16,
    backgroundIntensity: 1.08,
    swatches: ['#fef3c7', '#a16207'],
    description: 'Grand hall ambience with chandeliers for polished highlights.'
  },
  {
    id: 'rooftopNight',
    name: 'Rooftop Night',
    assetId: 'rooftop_night',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1680,
    exposure: 1.2,
    environmentIntensity: 1.18,
    backgroundIntensity: 1.12,
    swatches: ['#0ea5e9', '#111827'],
    description: 'Nocturnal rooftop glow with neon spill for chrome drama.'
  },
  {
    id: 'industrialSunset',
    name: 'Industrial Sunset',
    assetId: 'industrial_sunset_02',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1720,
    exposure: 1.17,
    environmentIntensity: 1.14,
    backgroundIntensity: 1.06,
    swatches: ['#f97316', '#1f2937'],
    description: 'Rustic industrial dusk with warm rim and cool fill mix.'
  },
  {
    id: 'snookerRoom',
    name: 'Snooker Room',
    assetUrls: {
      '4k': 'https://public.blenderkit.com/assets/5484e9402a4c416da2c7f30a9912ca27/files/resolution_4K_5455ef52-a73c-4b55-bf22-a0a9378eb5eb.exr',
      '2k': 'https://public.blenderkit.com/assets/5484e9402a4c416da2c7f30a9912ca27/files/resolution_2K_378ff822-6c29-4941-9bd1-74e05f220dae.exr',
      '1k': 'https://public.blenderkit.com/assets/5484e9402a4c416da2c7f30a9912ca27/files/resolution_1K_110774df-afff-4216-aead-6d58b69e8c29.exr'
    },
    preferredResolutions: ['4k', '2k', '1k'],
    fallbackResolution: '4k',
    fallbackUrl: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/billiard_hall_4k.hdr',
    price: 1740,
    exposure: 1.13,
    environmentIntensity: 1.08,
    backgroundIntensity: 1.04,
    swatches: ['#22c55e', '#0ea5e9'],
    description: 'BlenderKit free snooker hall mood with arcade-side fill.'
  },
  {
    id: 'emptyPlayRoom',
    name: 'Empty Play Room',
    assetId: 'empty_play_room',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1760,
    exposure: 1.09,
    environmentIntensity: 1.04,
    backgroundIntensity: 1,
    swatches: ['#a855f7', '#22c55e'],
    description: 'Quiet game room ambience with even indoor bounce.'
  },
  {
    id: 'christmasPhotoStudio04',
    name: 'Christmas Photo Studio 04',
    assetId: 'christmas_photo_studio_04',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1780,
    exposure: 1.12,
    environmentIntensity: 1.08,
    backgroundIntensity: 1.04,
    swatches: ['#ef4444', '#f59e0b'],
    description: 'Festive studio wraps with warm gift-light accents.'
  },
  {
    id: 'billiardHall',
    name: 'Billiard Hall',
    assetId: 'billiard_hall',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1800,
    exposure: 1.11,
    environmentIntensity: 1.06,
    backgroundIntensity: 1.02,
    swatches: ['#0ea5e9', '#22c55e'],
    description: 'Realistic billiard hall lighting with focused overheads.'
  },
  {
    id: 'colorfulStudio',
    name: 'Colorful Studio',
    assetId: 'colorful_studio',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1820,
    exposure: 1.11,
    environmentIntensity: 1.07,
    backgroundIntensity: 1.03,
    swatches: ['#ec4899', '#a855f7'],
    description: 'Playful multi-hue studio for glossy highlight variety.'
  },
  {
    id: 'dancingHall',
    name: 'Dancing Hall',
    assetId: 'dancing_hall',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1840,
    exposure: 1.12,
    environmentIntensity: 1.08,
    backgroundIntensity: 1.04,
    swatches: ['#22c55e', '#f97316'],
    description: 'Spacious dance hall bounce light for soft, even sheen.'
  }
]);

export const POOL_ROYALE_HDRI_VARIANT_MAP = Object.freeze(
  POOL_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
    acc[variant.id] = variant;
    return acc;
  }, {})
);

export const POOL_ROYALE_DEFAULT_HDRI_ID = POOL_ROYALE_HDRI_VARIANTS[0].id;

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
  environmentHdri: Object.freeze(
    POOL_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
      acc[variant.id] = variant.name;
      return acc;
    }, {})
  ),
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
  ...POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
    id: `hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price,
    description: variant.description
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
    label: POOL_ROYALE_OPTION_LABELS.environmentHdri[POOL_ROYALE_DEFAULT_HDRI_ID]
  }
];
