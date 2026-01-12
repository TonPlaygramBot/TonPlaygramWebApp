import { SNOOKER_ROYALE_CLOTH_VARIANTS } from './snookerRoyalClothPresets.js';

const SNOOKER_ROYALE_HDRI_PLACEMENTS = Object.freeze({
  neonPhotostudio: {
    cameraHeightM: 1.52,
    groundRadiusMultiplier: 3.8,
    groundResolution: 120,
    arenaScale: 1.1
  },
  colorfulStudio: {
    cameraHeightM: 1.5,
    groundRadiusMultiplier: 4,
    groundResolution: 120,
    arenaScale: 1.15,
    rotationY: Math.PI / 2
  },
  dancingHall: {
    cameraHeightM: 1.58,
    groundRadiusMultiplier: 5,
    groundResolution: 112,
    arenaScale: 1.3
  },
  abandonedHall: {
    cameraHeightM: 1.6,
    groundRadiusMultiplier: 5.2,
    groundResolution: 112,
    arenaScale: 1.25
  },
  mirroredHall: {
    cameraHeightM: 1.58,
    groundRadiusMultiplier: 5,
    groundResolution: 112,
    arenaScale: 1.25
  },
  musicHall02: {
    cameraHeightM: 1.6,
    groundRadiusMultiplier: 5.2,
    groundResolution: 112,
    arenaScale: 1.3
  },
  oldHall: {
    cameraHeightM: 1.58,
    groundRadiusMultiplier: 5,
    groundResolution: 112,
    arenaScale: 1.22
  },
  blockyPhotoStudio: {
    cameraHeightM: 1.5,
    groundRadiusMultiplier: 3.9,
    groundResolution: 120,
    arenaScale: 1.14,
    rotationY: -Math.PI / 2
  },
  cycloramaHardLight: {
    cameraHeightM: 1.5,
    groundRadiusMultiplier: 3.8,
    groundResolution: 120,
    arenaScale: 1.15
  },
  abandonedGarage: {
    cameraHeightM: 1.6,
    groundRadiusMultiplier: 5.1,
    groundResolution: 112,
    arenaScale: 1.26,
    rotationY: Math.PI / 2
  },
  vestibule: {
    cameraHeightM: 1.56,
    groundRadiusMultiplier: 4.7,
    groundResolution: 112,
    arenaScale: 1.2,
    rotationY: 0
  },
  countryClub: {
    cameraHeightM: 1.58,
    groundRadiusMultiplier: 4.9,
    groundResolution: 112,
    arenaScale: 1.24,
    rotationY: Math.PI
  },
  sepulchralChapelRotunda: {
    cameraHeightM: 1.62,
    groundRadiusMultiplier: 5.6,
    groundResolution: 112,
    arenaScale: 1.32
  },
  squashCourt: {
    cameraHeightM: 1.5,
    groundRadiusMultiplier: 4.1,
    groundResolution: 120,
    arenaScale: 1.18,
    rotationY: Math.PI / 2
  }
});

const RAW_SNOOKER_ROYALE_HDRI_VARIANTS = [
  {
    id: 'neonPhotostudio',
    name: 'Neon Photo Studio',
    assetId: 'neon_photostudio',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 1420,
    exposure: 1.18,
    environmentIntensity: 1.12,
    backgroundIntensity: 1.06,
    swatches: ['#0ea5e9', '#8b5cf6'],
    description: 'Vibrant cyber studio wrap with strong rim accents.'
  },
  {
    id: 'colorfulStudio',
    name: 'Colorful Studio',
    assetId: 'colorful_studio',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 0,
    exposure: 1.02,
    environmentIntensity: 0.92,
    backgroundIntensity: 0.92,
    swatches: ['#ec4899', '#a855f7'],
    description: 'Playful multi-hue studio for glossy highlight variety.'
  },
  {
    id: 'dancingHall',
    name: 'Dancing Hall',
    assetId: 'dancing_hall',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 1840,
    exposure: 1.12,
    environmentIntensity: 1.08,
    backgroundIntensity: 1.04,
    swatches: ['#22c55e', '#f97316'],
    description: 'Spacious dance hall bounce light for soft, even sheen.'
  },
  {
    id: 'abandonedHall',
    name: 'Abandoned Hall',
    assetId: 'abandoned_hall_01',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 1860,
    exposure: 1.08,
    environmentIntensity: 1.05,
    backgroundIntensity: 0.98,
    swatches: ['#64748b', '#0f172a'],
    description: 'Moody derelict hall with soft overhead spill and cool shadows.'
  },
  {
    id: 'mirroredHall',
    name: 'Mirrored Hall',
    assetId: 'mirrored_hall',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2020,
    exposure: 1.15,
    environmentIntensity: 1.12,
    backgroundIntensity: 1.06,
    swatches: ['#22c55e', '#10b981'],
    description: 'Reflective hall with bright symmetrical highlights for chrome polish.'
  },
  {
    id: 'musicHall02',
    name: 'Music Hall 02',
    assetId: 'music_hall_02',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2060,
    exposure: 1.11,
    environmentIntensity: 1.08,
    backgroundIntensity: 1.04,
    swatches: ['#a855f7', '#2563eb'],
    description: 'Alternate music hall mood with richer purple-blue spill and soft roof glow.'
  },
  {
    id: 'oldHall',
    name: 'Old Hall',
    assetId: 'old_hall',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2080,
    exposure: 1.08,
    environmentIntensity: 1.05,
    backgroundIntensity: 0.99,
    swatches: ['#78350f', '#fbbf24'],
    description: 'Vintage hall ambience with warm wood bounce and subtle window fill.'
  },
  {
    id: 'blockyPhotoStudio',
    name: 'Blocky Photo Studio',
    assetId: 'blocky_photo_studio',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2200,
    exposure: 1.12,
    environmentIntensity: 1.1,
    backgroundIntensity: 1.05,
    swatches: ['#60a5fa', '#a855f7'],
    description: 'Graphic studio blocks with crisp edges and balanced bounce.'
  },
  {
    id: 'cycloramaHardLight',
    name: 'Cyclorama Hard Light',
    assetId: 'cyclorama_hard_light',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2260,
    exposure: 1.16,
    environmentIntensity: 1.12,
    backgroundIntensity: 1.08,
    swatches: ['#f8fafc', '#94a3b8'],
    description: 'Studio cyc with punchy hard light and sharp specular falloff.'
  },
  {
    id: 'abandonedGarage',
    name: 'Abandoned Garage',
    assetId: 'abandoned_garage',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2340,
    exposure: 1.07,
    environmentIntensity: 1.04,
    backgroundIntensity: 0.98,
    swatches: ['#334155', '#94a3b8'],
    description: 'Gritty garage mood with diffused skylight and cool steel reflections.'
  },
  {
    id: 'vestibule',
    name: 'Vestibule',
    assetId: 'vestibule',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2360,
    exposure: 1.1,
    environmentIntensity: 1.06,
    backgroundIntensity: 1.02,
    swatches: ['#e2e8f0', '#64748b'],
    description: 'Elegant entry lighting with neutral stone bounce and soft fill.'
  },
  {
    id: 'countryClub',
    name: 'Country Club',
    assetId: 'country_club',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2380,
    exposure: 1.11,
    environmentIntensity: 1.08,
    backgroundIntensity: 1.03,
    swatches: ['#f8fafc', '#22c55e'],
    description: 'Upscale lounge ambience with bright daylight and warm interiors.'
  },
  {
    id: 'sepulchralChapelRotunda',
    name: 'Sepulchral Chapel Rotunda',
    assetId: 'sepulchral_chapel_rotunda',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2480,
    exposure: 1.06,
    environmentIntensity: 1.03,
    backgroundIntensity: 0.98,
    swatches: ['#1f2937', '#6b7280'],
    description: 'Stone rotunda with dramatic overhead light and deep shadows.'
  },
  {
    id: 'squashCourt',
    name: 'Squash Court',
    assetId: 'squash_court',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2440,
    exposure: 1.1,
    environmentIntensity: 1.06,
    backgroundIntensity: 1.02,
    swatches: ['#f8fafc', '#f97316'],
    description: 'Bright court lighting with clean white walls and strong bounce.'
  },
];

const HDRI_RESOLUTION_STACK = Object.freeze(['4k', '2k']);

export const SNOOKER_ROYALE_HDRI_VARIANTS = Object.freeze(
  RAW_SNOOKER_ROYALE_HDRI_VARIANTS.map((variant) => ({
    ...variant,
    preferredResolutions: HDRI_RESOLUTION_STACK,
    ...(SNOOKER_ROYALE_HDRI_PLACEMENTS[variant.id] || {})
  }))
);

export const SNOOKER_ROYALE_HDRI_VARIANT_MAP = Object.freeze(
  SNOOKER_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
    acc[variant.id] = variant;
    return acc;
  }, {})
);

export const SNOOKER_ROYALE_BASE_VARIANTS = Object.freeze([
  {
    id: 'classicCylinders',
    name: 'Classic Cylinders',
    description: 'Rounded skirt with six cylinder legs and subtle foot pads.',
    swatches: ['#8f6243', '#6f3a2f']
  },
  {
    id: 'openPortal',
    name: 'Open Portal',
    description: 'Twin portal legs with angled sides and negative space.',
    swatches: ['#f8fafc', '#e5e7eb']
  },
  {
    id: 'coffeeTableRound01',
    name: 'Coffee Table Round 01 Base',
    description: 'Rounded Poly Haven coffee table legs tucked beneath the pool table.',
    swatches: ['#c5a47e', '#7a5534']
  },
  {
    id: 'gothicCoffeeTable',
    name: 'Gothic Coffee Table Base',
    description: 'Gothic coffee table from Murlan Royale re-used as a sculpted support base.',
    swatches: ['#8f4a2b', '#3b2a1f']
  },
  {
    id: 'woodenTable02Alt',
    name: 'Wooden Table 02 Alt Base',
    description: 'Alternate Wooden Table 02 variant resized to cradle the pool playfield.',
    swatches: ['#6f5140', '#caa07a']
  }
]);

export const SNOOKER_ROYALE_DEFAULT_HDRI_ID = 'colorfulStudio';

export const SNOOKER_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableFinish: ['peelingPaintWeathered'],
  chromeColor: ['gold'],
  railMarkerColor: ['gold'],
  clothColor: [SNOOKER_ROYALE_CLOTH_VARIANTS[0].id],
  cueStyle: ['birch-frost'],
  pocketLiner: ['fabric_leather_02'],
  environmentHdri: [SNOOKER_ROYALE_DEFAULT_HDRI_ID],
  tableBase: SNOOKER_ROYALE_BASE_VARIANTS.map((variant) => variant.id)
});

export const SNOOKER_ROYALE_OPTION_LABELS = Object.freeze({
  environmentHdri: Object.freeze(
    SNOOKER_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
      acc[variant.id] = variant.name;
      return acc;
    }, {})
  ),
  tableFinish: Object.freeze({
    peelingPaintWeathered: 'Wood Peeling Paint Weathered',
    oakVeneer01: 'Oak Veneer 01',
    woodTable001: 'Wood Table 001',
    darkWood: 'Dark Wood',
    rosewoodVeneer01: 'Rosewood Veneer 01'
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
    SNOOKER_ROYALE_CLOTH_VARIANTS.reduce((acc, variant) => {
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
  tableBase: Object.freeze(
    SNOOKER_ROYALE_BASE_VARIANTS.reduce((acc, variant) => {
      acc[variant.id] = variant.name;
      return acc;
    }, {})
  ),
  pocketLiner: Object.freeze({
    fabric_leather_02: 'Fabric Leather 02 Pocket Jaws',
    fabric_leather_01: 'Fabric Leather 01 Pocket Jaws',
    brown_leather: 'Brown Leather Pocket Jaws',
    leather_red_02: 'Leather Red 02 Pocket Jaws',
    leather_red_03: 'Leather Red 03 Pocket Jaws',
    leather_white: 'Leather White Pocket Jaws'
  })
});

export const SNOOKER_ROYALE_STORE_ITEMS = [
  {
    id: 'finish-peelingPaintWeathered',
    type: 'tableFinish',
    optionId: 'peelingPaintWeathered',
    name: 'Wood Peeling Paint Weathered Finish',
    price: 980,
    description: 'Weathered peeling paint wood rails with a reclaimed finish.'
  },
  {
    id: 'finish-oakVeneer01',
    type: 'tableFinish',
    optionId: 'oakVeneer01',
    name: 'Oak Veneer 01 Finish',
    price: 990,
    description: 'Warm oak veneer rails with smooth satin polish.'
  },
  {
    id: 'finish-woodTable001',
    type: 'tableFinish',
    optionId: 'woodTable001',
    name: 'Wood Table 001 Finish',
    price: 1000,
    description: 'Balanced walnut-brown rails inspired by classic table slabs.'
  },
  {
    id: 'finish-darkWood',
    type: 'tableFinish',
    optionId: 'darkWood',
    name: 'Dark Wood Finish',
    price: 1010,
    description: 'Deep espresso rails with strong grain contrast.'
  },
  {
    id: 'finish-rosewoodVeneer01',
    type: 'tableFinish',
    optionId: 'rosewoodVeneer01',
    name: 'Rosewood Veneer 01 Finish',
    price: 1020,
    description: 'Rosewood veneer rails with rich, reddish undertones.'
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
  ...SNOOKER_ROYALE_CLOTH_VARIANTS.map((variant) => ({
    id: `cloth-${variant.id}`,
    type: 'clothColor',
    optionId: variant.id,
    name: variant.name,
    price: variant.price,
    description: variant.description
  })),
  {
    id: 'pocket-fabric-leather-02',
    type: 'pocketLiner',
    optionId: 'fabric_leather_02',
    name: 'Fabric Leather 02 Pocket Jaws',
    price: 520,
    description: 'Warm stitched leather weave liners for the classic Snooker Royal look.'
  },
  {
    id: 'pocket-fabric-leather-01',
    type: 'pocketLiner',
    optionId: 'fabric_leather_01',
    name: 'Fabric Leather 01 Pocket Jaws',
    price: 530,
    description: 'Soft-grain leather weave liners with a mellow brown finish.'
  },
  {
    id: 'pocket-brown-leather',
    type: 'pocketLiner',
    optionId: 'brown_leather',
    name: 'Brown Leather Pocket Jaws',
    price: 540,
    description: 'Deep brown leather pockets with natural creases and aged texture.'
  },
  {
    id: 'pocket-leather-red-02',
    type: 'pocketLiner',
    optionId: 'leather_red_02',
    name: 'Leather Red 02 Pocket Jaws',
    price: 560,
    description: 'Bold red leather liners with pronounced seams and worn highlights.'
  },
  {
    id: 'pocket-leather-red-03',
    type: 'pocketLiner',
    optionId: 'leather_red_03',
    name: 'Leather Red 03 Pocket Jaws',
    price: 570,
    description: 'Deep crimson leather pocket liners with subtle stitch detailing.'
  },
  {
    id: 'pocket-leather-white',
    type: 'pocketLiner',
    optionId: 'leather_white',
    name: 'Leather White Pocket Jaws',
    price: 590,
    description: 'Bright white leather pockets with crisp seam definition and clean grain.'
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
  ...SNOOKER_ROYALE_BASE_VARIANTS.map((variant) => ({
    id: `base-${variant.id}`,
    type: 'tableBase',
    optionId: variant.id,
    name: `${variant.name} Base`,
    price: 0,
    description: variant.description
  })),
  ...SNOOKER_ROYALE_HDRI_VARIANTS.map((variant) => ({
    id: `hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price,
    description: variant.description
  }))
];

export const SNOOKER_ROYALE_DEFAULT_LOADOUT = [
  {
    type: 'tableFinish',
    optionId: 'peelingPaintWeathered',
    label: 'Wood Peeling Paint Weathered Finish'
  },
  { type: 'chromeColor', optionId: 'gold', label: 'Gold Chrome Plates' },
  { type: 'railMarkerColor', optionId: 'gold', label: 'Gold Diamond Markers' },
  {
    type: 'clothColor',
    optionId: SNOOKER_ROYALE_CLOTH_VARIANTS[0].id,
    label: SNOOKER_ROYALE_CLOTH_VARIANTS[0].name
  },
  { type: 'cueStyle', optionId: 'birch-frost', label: 'Birch Frost Cue' },
  { type: 'pocketLiner', optionId: 'fabric_leather_02', label: 'Fabric Leather 02 Pocket Jaws' },
  {
    type: 'tableBase',
    optionId: SNOOKER_ROYALE_BASE_VARIANTS[0].id,
    label: SNOOKER_ROYALE_BASE_VARIANTS[0].name
  },
  {
    type: 'environmentHdri',
    optionId: SNOOKER_ROYALE_DEFAULT_HDRI_ID,
    label: SNOOKER_ROYALE_OPTION_LABELS.environmentHdri[SNOOKER_ROYALE_DEFAULT_HDRI_ID]
  }
];
