import { POOL_ROYALE_CLOTH_VARIANTS } from './poolRoyaleClothPresets.js';

const POOL_ROYALE_HDRI_PLACEMENTS = Object.freeze({
  neonPhotostudio: {
    cameraHeightM: 1.52,
    groundRadiusMultiplier: 3.8,
    groundResolution: 120,
    arenaScale: 1.1
  },
  christmasPhotoStudio04: {
    cameraHeightM: 1.52,
    groundRadiusMultiplier: 3.9,
    groundResolution: 120,
    arenaScale: 1.15
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
  marryHall: {
    cameraHeightM: 1.57,
    groundRadiusMultiplier: 4.9,
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
  loftPhotoStudioHall: {
    cameraHeightM: 1.54,
    groundRadiusMultiplier: 4.6,
    groundResolution: 120,
    arenaScale: 1.18,
    rotationY: Math.PI
  },
  londonPhotoStudioHall: {
    cameraHeightM: 1.56,
    groundRadiusMultiplier: 4.8,
    groundResolution: 120,
    arenaScale: 1.18
  },
  countryStudioHall: {
    cameraHeightM: 1.55,
    groundRadiusMultiplier: 4.5,
    groundResolution: 112,
    arenaScale: 1.18,
    rotationY: 0
  },
  blockyPhotoStudio: {
    cameraHeightM: 1.5,
    groundRadiusMultiplier: 3.9,
    groundResolution: 120,
    arenaScale: 1.14,
    rotationY: -Math.PI / 2
  },
  bluePhotoStudio: {
    cameraHeightM: 1.52,
    groundRadiusMultiplier: 4,
    groundResolution: 120,
    arenaScale: 1.16
  },
  cycloramaHardLight: {
    cameraHeightM: 1.5,
    groundRadiusMultiplier: 3.8,
    groundResolution: 120,
    arenaScale: 1.15
  },
  brownPhotostudio06: {
    cameraHeightM: 1.51,
    groundRadiusMultiplier: 4,
    groundResolution: 120,
    arenaScale: 1.15,
    rotationY: Math.PI / 2
  },
  christmasPhotoStudio05: {
    cameraHeightM: 1.52,
    groundRadiusMultiplier: 3.9,
    groundResolution: 120,
    arenaScale: 1.15,
    rotationY: Math.PI / 2
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
  brownPhotostudio03: {
    cameraHeightM: 1.5,
    groundRadiusMultiplier: 3.9,
    groundResolution: 120,
    arenaScale: 1.14,
    rotationY: Math.PI / 2
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

const RAW_POOL_ROYALE_HDRI_VARIANTS = [
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
    id: 'colorfulStudio',
    name: 'Colorful Studio',
    assetId: 'colorful_studio',
    preferredResolutions: ['4k', '2k'],
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
    preferredResolutions: ['4k', '2k'],
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
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1860,
    exposure: 1.08,
    environmentIntensity: 1.05,
    backgroundIntensity: 0.98,
    swatches: ['#64748b', '#0f172a'],
    description: 'Moody derelict hall with soft overhead spill and cool shadows.'
  },
  {
    id: 'marryHall',
    name: 'Marry Hall',
    assetId: 'marry_hall',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2000,
    exposure: 1.12,
    environmentIntensity: 1.08,
    backgroundIntensity: 1.04,
    swatches: ['#f8fafc', '#a3e635'],
    description: 'Bright ceremony hall with clean neutral bounce and gentle highlights.'
  },
  {
    id: 'mirroredHall',
    name: 'Mirrored Hall',
    assetId: 'mirrored_hall',
    preferredResolutions: ['4k', '2k'],
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
    preferredResolutions: ['4k', '2k'],
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
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2080,
    exposure: 1.08,
    environmentIntensity: 1.05,
    backgroundIntensity: 0.99,
    swatches: ['#78350f', '#fbbf24'],
    description: 'Vintage hall ambience with warm wood bounce and subtle window fill.'
  },
  {
    id: 'loftPhotoStudioHall',
    name: 'Loft Photo Studio Hall',
    assetId: 'photo_studio_loft_hall',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2120,
    exposure: 1.12,
    environmentIntensity: 1.08,
    backgroundIntensity: 1.03,
    swatches: ['#22d3ee', '#f59e0b'],
    description: 'Loft hall softbox mix with airy daylight wrap and warm practicals.'
  },
  {
    id: 'londonPhotoStudioHall',
    name: 'London Photo Studio Hall',
    assetId: 'photo_studio_london_hall',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2140,
    exposure: 1.14,
    environmentIntensity: 1.1,
    backgroundIntensity: 1.05,
    swatches: ['#0ea5e9', '#fbbf24'],
    description: 'London studio hall ambiance with cool skylight and warm edge kickers.'
  },
  {
    id: 'countryStudioHall',
    name: 'Country Studio Hall',
    assetId: 'studio_country_hall',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2180,
    exposure: 1.11,
    environmentIntensity: 1.08,
    backgroundIntensity: 1.02,
    swatches: ['#f472b6', '#16a34a'],
    description: 'Cozy country hall with warm wood bounce and soft window key light.'
  },
  {
    id: 'blockyPhotoStudio',
    name: 'Blocky Photo Studio',
    assetId: 'blocky_photo_studio',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2200,
    exposure: 1.12,
    environmentIntensity: 1.1,
    backgroundIntensity: 1.05,
    swatches: ['#60a5fa', '#a855f7'],
    description: 'Graphic studio blocks with crisp edges and balanced bounce.'
  },
  {
    id: 'bluePhotoStudio',
    name: 'Blue Photo Studio',
    assetId: 'blue_photo_studio',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2220,
    exposure: 1.13,
    environmentIntensity: 1.11,
    backgroundIntensity: 1.06,
    swatches: ['#38bdf8', '#1e40af'],
    description: 'Cool blue studio lighting with bright fills and soft kickers.'
  },
  {
    id: 'cycloramaHardLight',
    name: 'Cyclorama Hard Light',
    assetId: 'cyclorama_hard_light',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2260,
    exposure: 1.16,
    environmentIntensity: 1.12,
    backgroundIntensity: 1.08,
    swatches: ['#f8fafc', '#94a3b8'],
    description: 'Studio cyc with punchy hard light and sharp specular falloff.'
  },
  {
    id: 'brownPhotostudio06',
    name: 'Brown Photostudio 06',
    assetId: 'brown_photostudio_06',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2280,
    exposure: 1.11,
    environmentIntensity: 1.07,
    backgroundIntensity: 1.03,
    swatches: ['#a16207', '#f59e0b'],
    description: 'Warm brown studio wrap with soft amber highlights.'
  },
  {
    id: 'christmasPhotoStudio05',
    name: 'Christmas Photo Studio 05',
    assetId: 'christmas_photo_studio_05',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2300,
    exposure: 1.13,
    environmentIntensity: 1.1,
    backgroundIntensity: 1.05,
    swatches: ['#ef4444', '#22c55e'],
    description: 'Holiday studio glow with warm reds and festive green accents.'
  },
  {
    id: 'abandonedGarage',
    name: 'Abandoned Garage',
    assetId: 'abandoned_garage',
    preferredResolutions: ['4k', '2k'],
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
    preferredResolutions: ['4k', '2k'],
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
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2380,
    exposure: 1.11,
    environmentIntensity: 1.08,
    backgroundIntensity: 1.03,
    swatches: ['#f8fafc', '#22c55e'],
    description: 'Upscale lounge ambience with bright daylight and warm interiors.'
  },
  {
    id: 'brownPhotostudio03',
    name: 'Brown Photostudio 03',
    assetId: 'brown_photostudio_03',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2400,
    exposure: 1.1,
    environmentIntensity: 1.06,
    backgroundIntensity: 1.02,
    swatches: ['#92400e', '#fbbf24'],
    description: 'Rich brown studio tones with smooth amber reflections.'
  },
  {
    id: 'sepulchralChapelRotunda',
    name: 'Sepulchral Chapel Rotunda',
    assetId: 'sepulchral_chapel_rotunda',
    preferredResolutions: ['4k', '2k'],
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
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2440,
    exposure: 1.1,
    environmentIntensity: 1.06,
    backgroundIntensity: 1.02,
    swatches: ['#f8fafc', '#f97316'],
    description: 'Bright court lighting with clean white walls and strong bounce.'
  },
];

const HDRI_RESOLUTION_STACK = Object.freeze(['8k', '6k', '4k', '2k']);

export const POOL_ROYALE_HDRI_VARIANTS = Object.freeze(
  RAW_POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
    ...variant,
    preferredResolutions: HDRI_RESOLUTION_STACK,
    ...(POOL_ROYALE_HDRI_PLACEMENTS[variant.id] || {})
  }))
);

export const POOL_ROYALE_HDRI_VARIANT_MAP = Object.freeze(
  POOL_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
    acc[variant.id] = variant;
    return acc;
  }, {})
);

export const POOL_ROYALE_BASE_VARIANTS = Object.freeze([
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
    id: 'coffeeTable01',
    name: 'Coffee Table 01 Base',
    description: 'Poly Haven Coffee Table 01 from Murlan Royale sized to support the pool deck.',
    swatches: ['#8b7355', '#d6c1a3']
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
    id: 'murlanDefaultTable',
    name: 'Murlan Default Table Base',
    description: 'Scaled version of the Murlan Royale default table supporting the pool deck.',
    swatches: ['#9b7350', '#d7b594']
  },
  {
    id: 'woodenTable02',
    name: 'Wooden Table 02 Base',
    description: 'Poly Haven Wooden Table 02 adapted to the Pool Royale frame proportions.',
    swatches: ['#7d5a3c', '#c7a27d']
  },
  {
    id: 'chineseTeaTable',
    name: 'Chinese Tea Table Base',
    description: 'Low-profile Chinese tea table from Murlan Royale fitted beneath the pool table.',
    swatches: ['#70452f', '#d1a573']
  },
  {
    id: 'woodenTable02Alt',
    name: 'Wooden Table 02 Alt Base',
    description: 'Alternate Wooden Table 02 variant resized to cradle the pool playfield.',
    swatches: ['#6f5140', '#caa07a']
  },
  {
    id: 'roundWoodenTable01',
    name: 'Round Wooden Table 01 Base',
    description: 'Circular wooden base with generous footprint for the pool layout.',
    swatches: ['#805b3a', '#c99f72']
  }
]);

export const POOL_ROYALE_DEFAULT_HDRI_ID = 'colorfulStudio';

export const POOL_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableFinish: ['peelingPaintWeathered'],
  chromeColor: ['gold'],
  railMarkerColor: ['gold'],
  clothColor: [POOL_ROYALE_CLOTH_VARIANTS[0].id],
  cueStyle: ['birch-frost'],
  pocketLiner: ['blackPocket'],
  environmentHdri: [POOL_ROYALE_DEFAULT_HDRI_ID],
  tableBase: POOL_ROYALE_BASE_VARIANTS.map((variant) => variant.id)
});

export const POOL_ROYALE_OPTION_LABELS = Object.freeze({
  environmentHdri: Object.freeze(
    POOL_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
      acc[variant.id] = variant.name;
      return acc;
    }, {})
  ),
  tableFinish: Object.freeze({
    peelingPaintWeathered: 'Wood Peeling Paint Weathered',
    oakVeneer01: 'Oak Veneer 01',
    woodTable001: 'Wood Table 001',
    darkWood: 'Dark Wood',
    rosewoodVeneer01: 'Rosewood Veneer 01',
    rosewoodVeneerAmber: 'Rosewood Veneer Amber',
    rosewoodVeneerWalnut: 'Rosewood Veneer Walnut',
    rosewoodVeneerEbony: 'Rosewood Veneer Ebony',
    rosewoodVeneerHoney: 'Rosewood Veneer Honey',
    rosewoodVeneerAsh: 'Rosewood Veneer Ash'
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
  tableBase: Object.freeze(
    POOL_ROYALE_BASE_VARIANTS.reduce((acc, variant) => {
      acc[variant.id] = variant.name;
      return acc;
    }, {})
  ),
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
    id: 'finish-rosewoodVeneerAmber',
    type: 'tableFinish',
    optionId: 'rosewoodVeneerAmber',
    name: 'Rosewood Veneer Amber Finish',
    price: 1030,
    description: 'Amber-tinted rosewood veneer with warm copper rail highlights.'
  },
  {
    id: 'finish-rosewoodVeneerWalnut',
    type: 'tableFinish',
    optionId: 'rosewoodVeneerWalnut',
    name: 'Rosewood Veneer Walnut Finish',
    price: 1040,
    description: 'Walnut-inspired rosewood veneer for a deep, balanced brown tone.'
  },
  {
    id: 'finish-rosewoodVeneerEbony',
    type: 'tableFinish',
    optionId: 'rosewoodVeneerEbony',
    name: 'Rosewood Veneer Ebony Finish',
    price: 1050,
    description: 'Ebony-shaded rosewood veneer with dark rails and subtle sheen.'
  },
  {
    id: 'finish-rosewoodVeneerHoney',
    type: 'tableFinish',
    optionId: 'rosewoodVeneerHoney',
    name: 'Rosewood Veneer Honey Finish',
    price: 1060,
    description: 'Honey-gold rosewood veneer for a brighter, golden rail glow.'
  },
  {
    id: 'finish-rosewoodVeneerAsh',
    type: 'tableFinish',
    optionId: 'rosewoodVeneerAsh',
    name: 'Rosewood Veneer Ash Finish',
    price: 1070,
    description: 'Ash-tinted rosewood veneer with cool neutral brown shading.'
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
  ...POOL_ROYALE_BASE_VARIANTS.map((variant) => ({
    id: `base-${variant.id}`,
    type: 'tableBase',
    optionId: variant.id,
    name: `${variant.name} Base`,
    price: 0,
    description: variant.description
  })),
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
  {
    type: 'tableFinish',
    optionId: 'peelingPaintWeathered',
    label: 'Wood Peeling Paint Weathered Finish'
  },
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
    type: 'tableBase',
    optionId: POOL_ROYALE_BASE_VARIANTS[0].id,
    label: POOL_ROYALE_BASE_VARIANTS[0].name
  },
  {
    type: 'environmentHdri',
    optionId: POOL_ROYALE_DEFAULT_HDRI_ID,
    label: POOL_ROYALE_OPTION_LABELS.environmentHdri[POOL_ROYALE_DEFAULT_HDRI_ID]
  }
];
