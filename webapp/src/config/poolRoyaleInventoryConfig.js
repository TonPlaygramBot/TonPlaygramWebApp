import { POOL_ROYALE_CLOTH_VARIANTS } from './poolRoyaleClothPresets.js';
import { polyHavenThumb, swatchThumbnail } from './storeThumbnails.js';

const POOL_ROYALE_HDRI_PLACEMENTS = Object.freeze({
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
  abandonedGarage: {
    cameraHeightM: 1.6,
    groundRadiusMultiplier: 5.1,
    groundResolution: 112,
    arenaScale: 1.26,
    rotationY: 0
  },
  vestibule: {
    cameraHeightM: 1.56,
    groundRadiusMultiplier: 4.7,
    groundResolution: 112,
    arenaScale: 1.2,
    rotationY: 0
  },
  sepulchralChapelRotunda: {
    cameraHeightM: 1.62,
    groundRadiusMultiplier: 5.6,
    groundResolution: 112,
    arenaScale: 1.32
  },
  polyHavenStudio: {
    cameraHeightM: 1.5,
    groundRadiusMultiplier: 3.9,
    groundResolution: 120,
    arenaScale: 1.14
  },
  cinemaLobby: {
    cameraHeightM: 1.58,
    groundRadiusMultiplier: 5.2,
    groundResolution: 112,
    arenaScale: 1.26,
    rotationY: Math.PI / 2
  },
  churchMeetingRoom: {
    cameraHeightM: 1.56,
    groundRadiusMultiplier: 4.9,
    groundResolution: 112,
    arenaScale: 1.23
  },
  warmBar: {
    cameraHeightM: 1.52,
    groundRadiusMultiplier: 4.6,
    groundResolution: 112,
    arenaScale: 1.2
  },
  pineAttic: {
    cameraHeightM: 1.56,
    groundRadiusMultiplier: 4.8,
    groundResolution: 112,
    arenaScale: 1.22
  },
  rostockArches: {
    cameraHeightM: 1.6,
    groundRadiusMultiplier: 5.3,
    groundResolution: 112,
    arenaScale: 1.28
  },
  vignaioliNight: {
    cameraHeightM: 1.57,
    groundRadiusMultiplier: 5,
    groundResolution: 112,
    arenaScale: 1.25
  },
  stPetersSquareNight: {
    cameraHeightM: 1.62,
    groundRadiusMultiplier: 5.6,
    groundResolution: 112,
    arenaScale: 1.33
  },
  zwingerNight: {
    cameraHeightM: 1.6,
    groundRadiusMultiplier: 5.4,
    groundResolution: 112,
    arenaScale: 1.29
  },
  winterEvening: {
    cameraHeightM: 1.58,
    groundRadiusMultiplier: 5.1,
    groundResolution: 112,
    arenaScale: 1.26
  },
  rathaus: {
    cameraHeightM: 1.58,
    groundRadiusMultiplier: 5.1,
    groundResolution: 112,
    arenaScale: 1.26
  },
  newmanLobby: {
    cameraHeightM: 1.58,
    groundRadiusMultiplier: 5,
    groundResolution: 112,
    arenaScale: 1.24,
    rotationY: 0
  },
  lapa: {
    cameraHeightM: 1.58,
    groundRadiusMultiplier: 5.1,
    groundResolution: 112,
    arenaScale: 1.26
  },
  medievalCafe: {
    cameraHeightM: 1.56,
    groundRadiusMultiplier: 4.9,
    groundResolution: 112,
    arenaScale: 1.23
  },
  crossfitGym: {
    cameraHeightM: 1.54,
    groundRadiusMultiplier: 4.6,
    groundResolution: 112,
    arenaScale: 1.21
  },
  voortrekkerInterior: {
    cameraHeightM: 1.58,
    groundRadiusMultiplier: 5.1,
    groundResolution: 112,
    arenaScale: 1.26
  }
});

const RAW_POOL_ROYALE_HDRI_VARIANTS = [
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
    id: 'polyHavenStudio',
    name: 'Poly Haven Studio',
    assetId: 'poly_haven_studio',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2520,
    exposure: 1.14,
    environmentIntensity: 1.1,
    backgroundIntensity: 1.05,
    swatches: ['#e2e8f0', '#94a3b8'],
    description: 'Official Poly Haven studio with neutral production-ready highlights.'
  },
  {
    id: 'cinemaLobby',
    name: 'Cinema Lobby',
    assetId: 'cinema_lobby',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2540,
    exposure: 1.1,
    environmentIntensity: 1.07,
    backgroundIntensity: 1.02,
    swatches: ['#334155', '#f59e0b'],
    description: 'Moody lobby reflections with warm marquee accents.'
  },
  {
    id: 'churchMeetingRoom',
    name: 'Church Meeting Room',
    assetId: 'church_meeting_room',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2560,
    exposure: 1.08,
    environmentIntensity: 1.05,
    backgroundIntensity: 1,
    swatches: ['#78716c', '#e7e5e4'],
    description: 'Quiet church hall ambience with soft diffuse overhead light.'
  },
  {
    id: 'warmBar',
    name: 'Warm Bar',
    assetId: 'warm_bar',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2580,
    exposure: 1.09,
    environmentIntensity: 1.06,
    backgroundIntensity: 1.01,
    swatches: ['#78350f', '#f97316'],
    description: 'Cozy bar interior with rich amber highlights and warm reflections.'
  },
  {
    id: 'pineAttic',
    name: 'Pine Attic',
    assetId: 'pine_attic',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2580,
    exposure: 1.08,
    environmentIntensity: 1.05,
    backgroundIntensity: 1,
    swatches: ['#854d0e', '#eab308'],
    description: 'Attic daylight filtered through pine timbers and warm wood bounce.'
  },
  {
    id: 'rostockArches',
    name: 'Rostock Arches',
    assetId: 'rostock_arches',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2620,
    exposure: 1.07,
    environmentIntensity: 1.04,
    backgroundIntensity: 0.99,
    swatches: ['#475569', '#cbd5e1'],
    description: 'Historic stone arches with cool exterior spill and broad contrast.'
  },
  {
    id: 'vignaioliNight',
    name: 'Vignaioli Night',
    assetId: 'vignaioli_night',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2640,
    exposure: 1.1,
    environmentIntensity: 1.07,
    backgroundIntensity: 1.02,
    swatches: ['#1d4ed8', '#f59e0b'],
    description: 'Nighttime courtyard with colorful practicals and cinematic contrast.'
  },
  {
    id: 'stPetersSquareNight',
    name: 'St. Peters Square Night',
    assetId: 'st_peters_square_night',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2660,
    exposure: 1.09,
    environmentIntensity: 1.06,
    backgroundIntensity: 1.01,
    swatches: ['#0f172a', '#f8fafc'],
    description: 'Grand night plaza lighting with polished marble bounce and deep sky.'
  },
  {
    id: 'zwingerNight',
    name: 'Zwinger Night',
    assetId: 'zwinger_night',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2680,
    exposure: 1.08,
    environmentIntensity: 1.05,
    backgroundIntensity: 1,
    swatches: ['#1e3a8a', '#fcd34d'],
    description: 'Illuminated baroque architecture with balanced cool-warm contrast.'
  },
  {
    id: 'winterEvening',
    name: 'Winter Evening',
    assetId: 'winter_evening',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2700,
    exposure: 1.06,
    environmentIntensity: 1.03,
    backgroundIntensity: 0.98,
    swatches: ['#334155', '#93c5fd'],
    description: 'Cold dusk atmosphere with soft ambient fill and muted reflections.'
  },
  {
    id: 'rathaus',
    name: 'Rathaus',
    assetId: 'rathaus',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2710,
    exposure: 1.08,
    environmentIntensity: 1.05,
    backgroundIntensity: 1,
    swatches: ['#374151', '#fbbf24'],
    description: 'Historic town hall lighting with warm facades and neutral shadows.'
  },
  {
    id: 'newmanLobby',
    name: 'Newman Lobby',
    assetId: 'newman_lobby',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2720,
    exposure: 1.1,
    environmentIntensity: 1.06,
    backgroundIntensity: 1.01,
    swatches: ['#374151', '#fde68a'],
    description: 'Modern hotel-style lobby with warm practicals and polished bounce.'
  },
  {
    id: 'lapa',
    name: 'Lapa',
    assetId: 'lapa',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2740,
    exposure: 1.09,
    environmentIntensity: 1.05,
    backgroundIntensity: 1,
    swatches: ['#0f766e', '#facc15'],
    description: 'Open urban scene with rich night color contrast and lively reflections.'
  },
  {
    id: 'medievalCafe',
    name: 'Medieval Cafe',
    assetId: 'medieval_cafe',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2760,
    exposure: 1.08,
    environmentIntensity: 1.05,
    backgroundIntensity: 1,
    swatches: ['#7c2d12', '#fcd34d'],
    description: 'Rustic café ambience with warm practical lights and cozy interior bounce.'
  },
  {
    id: 'crossfitGym',
    name: 'Crossfit Gym',
    assetId: 'crossfit_gym',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2780,
    exposure: 1.09,
    environmentIntensity: 1.06,
    backgroundIntensity: 1.01,
    swatches: ['#111827', '#ef4444'],
    description: 'Industrial training hall with strong overhead lighting structure.'
  },
  {
    id: 'voortrekkerInterior',
    name: 'Voortrekker Interior',
    assetId: 'voortrekker_interior',
    preferredResolutions: ['4k'],
    fallbackResolution: '4k',
    price: 2800,
    exposure: 1.07,
    environmentIntensity: 1.04,
    backgroundIntensity: 0.99,
    swatches: ['#4b5563', '#d6d3d1'],
    description: 'Large heritage interior with broad diffusion and calm tonal range.'
  },
];

const HDRI_RESOLUTION_STACK = Object.freeze(['8k', '4k', '2k']);

export const POOL_ROYALE_HDRI_VARIANTS = Object.freeze(
  RAW_POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
    ...variant,
    preferredResolutions:
      Array.isArray(variant.preferredResolutions) && variant.preferredResolutions.length
        ? variant.preferredResolutions
        : HDRI_RESOLUTION_STACK,
    fallbackResolution:
      variant.fallbackResolution ||
      (Array.isArray(variant.preferredResolutions) && variant.preferredResolutions[0]) ||
      HDRI_RESOLUTION_STACK[0],
    thumbnail: polyHavenThumb(variant.assetId),
    ...(POOL_ROYALE_HDRI_PLACEMENTS[variant.id] || {})
  }))
);

const TABLE_FINISH_THUMBNAILS = Object.freeze({
  peelingPaintWeathered: polyHavenThumb('wood_peeling_paint_weathered'),
  oakVeneer01: polyHavenThumb('oak_veneer_01'),
  woodTable001: polyHavenThumb('wood_table_001'),
  darkWood: polyHavenThumb('dark_wood'),
  rosewoodVeneer01: polyHavenThumb('rosewood_veneer_01'),
  carbonFiberChalk: swatchThumbnail(['#242b36', '#3b4452', '#576274']),
  carbonFiberChalkGrey: swatchThumbnail(['#717b88', '#99a4b2', '#ced5df']),
  carbonFiberChalkBeige: swatchThumbnail(['#45505c', '#5f6b79', '#84909e']),
  carbonFiberChalkDarkBlue: swatchThumbnail(['#6a3a31', '#8d5546', '#aa6f5c']),
  carbonFiberChalkWhite: swatchThumbnail(['#dacbb7', '#ecdecb', '#f7ede0']),
  carbonFiberChalkDarkGreen: swatchThumbnail(['#36523f', '#4a6f56', '#6a9878']),
  carbonFiberChalkDarkYellow: swatchThumbnail(['#987330', '#b38a3e', '#ceaa5a']),
  carbonFiberChalkDarkBrown: swatchThumbnail(['#684633', '#815843', '#9c7057']),
  carbonFiberChalkDarkRed: swatchThumbnail(['#7a2f2f', '#9b4343', '#b75a5a']),
  carbonFiberSnakeChalk: swatchThumbnail(['#242b36', '#3b4452', '#576274']),
  carbonFiberSnakeChalkGrey: swatchThumbnail(['#717b88', '#99a4b2', '#ced5df']),
  carbonFiberSnakeChalkBeige: swatchThumbnail(['#45505c', '#5f6b79', '#84909e']),
  carbonFiberSnakeChalkDarkBlue: swatchThumbnail(['#6a3a31', '#8d5546', '#aa6f5c']),
  carbonFiberSnakeChalkWhite: swatchThumbnail(['#dacbb7', '#ecdecb', '#f7ede0']),
  carbonFiberSnakeChalkDarkGreen: swatchThumbnail(['#36523f', '#4a6f56', '#6a9878']),
  carbonFiberAlligatorOlive: swatchThumbnail(['#45573a', '#62774f', '#87996d']),
  carbonFiberAlligatorSwamp: swatchThumbnail(['#2e4733', '#3f5f46', '#5f7c64']),
  carbonFiberAlligatorClay: swatchThumbnail(['#5c4939', '#7a624d', '#a3876d']),
  carbonFiberAlligatorSand: swatchThumbnail(['#786850', '#98856a', '#bba88a']),
  carbonFiberAlligatorMoss: swatchThumbnail(['#3f4f3c', '#5a6b54', '#7f9075']),
  carbonFiberAlligatorNight: swatchThumbnail(['#253128', '#36443a', '#566258'])
});

const POCKET_LINER_THUMBNAILS = Object.freeze({
  'plastic-black': swatchThumbnail(['#0b0d10', '#1f2937', '#4b5563']),
  'plastic-dark-grey': swatchThumbnail(['#1f2328', '#374151', '#6b7280']),
  'plastic-grey': swatchThumbnail(['#4b5563', '#6b7280', '#9ca3af']),
  'plastic-light-grey': swatchThumbnail(['#9ca3af', '#d1d5db', '#f3f4f6']),
  'plastic-magnolia': swatchThumbnail(['#efe9dc', '#f4f0e6', '#fff7ed'])
});

const CUE_STYLE_THUMBNAILS = Object.freeze({
  'redwood-ember': swatchThumbnail(['#7f1d1d', '#b91c1c', '#fde68a']),
  'birch-frost': swatchThumbnail(['#f8fafc', '#e2e8f0', '#bae6fd']),
  'wenge-nightfall': swatchThumbnail(['#0f172a', '#1f2937', '#64748b']),
  'mahogany-heritage': swatchThumbnail(['#7c2d12', '#b45309', '#fbbf24']),
  'walnut-satin': swatchThumbnail(['#5b3a29', '#8b5e34', '#f3d9b1']),
  'carbon-matrix': swatchThumbnail(['#0b0f16', '#111827', '#94a3b8']),
  'maple-horizon': swatchThumbnail(['#f5e6c8', '#d4b790', '#fde68a']),
  'graphite-aurora': swatchThumbnail(['#1f2937', '#4b5563', '#c7d2fe'])
});

const BASE_VARIANT_THUMBNAILS = Object.freeze({
  classicCylinders: swatchThumbnail(['#8f6243', '#6f3a2f', '#fef3c7']),
  openPortal: swatchThumbnail(['#f8fafc', '#e5e7eb', '#93c5fd']),
  coffeeTableRound01: polyHavenThumb('coffee_table_round_01'),
  gothicCoffeeTable: polyHavenThumb('gothic_coffee_table'),
  woodenTable02Alt: polyHavenThumb('wooden_table_02')
});

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
].map((variant) => ({
  ...variant,
  thumbnail: BASE_VARIANT_THUMBNAILS[variant.id]
})));

export const POOL_ROYALE_DEFAULT_HDRI_ID = 'colorfulStudio';

export const POOL_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableFinish: ['peelingPaintWeathered'],
  chromeColor: ['gold'],
  railMarkerColor: ['gold'],
  clothColor: [POOL_ROYALE_CLOTH_VARIANTS[0].id],
  cueStyle: ['birch-frost'],
  pocketLiner: ['plastic-black'],
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
    carbonFiberChalk: 'LT Black',
    carbonFiberChalkGrey: 'LT Grey',
    carbonFiberChalkBeige: 'LT Dark Grey',
    carbonFiberChalkDarkBlue: 'LT Burgundy',
    carbonFiberChalkWhite: 'LT Milk Cream',
    carbonFiberChalkDarkGreen: 'LT Dark Green',
    carbonFiberChalkDarkYellow: 'LT Dark Yellow',
    carbonFiberChalkDarkBrown: 'LT Dark Brown',
    carbonFiberChalkDarkRed: 'LT Dark Red',
    carbonFiberAlligatorOlive: 'LT Olive Alligator',
    carbonFiberAlligatorSwamp: 'LT Swamp Alligator',
    carbonFiberAlligatorClay: 'LT Clay Alligator',
    carbonFiberAlligatorSand: 'LT Sand Alligator',
    carbonFiberAlligatorMoss: 'LT Moss Alligator',
    carbonFiberAlligatorNight: 'LT Night Alligator'
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
    'plastic-black': 'Plastic Black Pocket Jaws',
    'plastic-dark-grey': 'Plastic Dark Grey Pocket Jaws',
    'plastic-grey': 'Plastic Grey Pocket Jaws',
    'plastic-light-grey': 'Plastic Light Grey Pocket Jaws',
    'plastic-magnolia': 'Plastic Magnolia Pocket Jaws'
  })
});

export const POOL_ROYALE_STORE_ITEMS = [
  {
    id: 'finish-peelingPaintWeathered',
    type: 'tableFinish',
    optionId: 'peelingPaintWeathered',
    name: 'Wood Peeling Paint Weathered Finish',
    price: 980,
    description: 'Weathered peeling paint wood rails with a reclaimed finish.',
    thumbnail: '/store-thumbs/poolRoyale/tableFinish/peelingPaintWeathered.png'
  },
  {
    id: 'finish-oakVeneer01',
    type: 'tableFinish',
    optionId: 'oakVeneer01',
    name: 'Oak Veneer 01 Finish',
    price: 990,
    description: 'Warm oak veneer rails with smooth satin polish.',
    thumbnail: '/store-thumbs/poolRoyale/tableFinish/oakVeneer01.png'
  },
  {
    id: 'finish-woodTable001',
    type: 'tableFinish',
    optionId: 'woodTable001',
    name: 'Wood Table 001 Finish',
    price: 1000,
    description: 'Balanced walnut-brown rails inspired by classic table slabs.',
    thumbnail: '/store-thumbs/poolRoyale/tableFinish/woodTable001.png'
  },
  {
    id: 'finish-darkWood',
    type: 'tableFinish',
    optionId: 'darkWood',
    name: 'Dark Wood Finish',
    price: 1010,
    description: 'Deep espresso rails with strong grain contrast.',
    thumbnail: TABLE_FINISH_THUMBNAILS.darkWood
  },
  {
    id: 'finish-rosewoodVeneer01',
    type: 'tableFinish',
    optionId: 'rosewoodVeneer01',
    name: 'Rosewood Veneer 01 Finish',
    price: 1020,
    description: 'Rosewood veneer rails with rich, reddish undertones.',
    thumbnail: TABLE_FINISH_THUMBNAILS.rosewoodVeneer01
  },
  {
    id: 'finish-carbonFiberChalk',
    type: 'tableFinish',
    optionId: 'carbonFiberChalk',
    name: 'LT Black Finish',
    price: 1160,
    description: 'Black LT carbon-fiber weave finish with a brighter charcoal tone.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberChalk
  },
  {
    id: 'finish-carbonFiberChalkGrey',
    type: 'tableFinish',
    optionId: 'carbonFiberChalkGrey',
    name: 'LT Grey Finish',
    price: 1170,
    description: 'Grey LT carbon-fiber weave finish tuned a touch brighter for clarity.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberChalkGrey
  },
  {
    id: 'finish-carbonFiberChalkBeige',
    type: 'tableFinish',
    optionId: 'carbonFiberChalkBeige',
    name: 'LT Dark Grey Finish',
    price: 1180,
    description: 'Dark-grey LT carbon-fiber weave finish with a slightly brighter lift.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberChalkBeige
  },
  {
    id: 'finish-carbonFiberChalkDarkBlue',
    type: 'tableFinish',
    optionId: 'carbonFiberChalkDarkBlue',
    name: 'LT Burgundy Finish',
    price: 1190,
    description: 'Burgundy LT finish shifted to rosewood-brown warmth.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberChalkDarkBlue
  },
  {
    id: 'finish-carbonFiberChalkWhite',
    type: 'tableFinish',
    optionId: 'carbonFiberChalkWhite',
    name: 'LT Milk Cream Finish',
    price: 1200,
    description: 'Milk-cream LT carbon-fiber weave finish with a deeper cream tone.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberChalkWhite
  },
  {
    id: 'finish-carbonFiberChalkDarkGreen',
    type: 'tableFinish',
    optionId: 'carbonFiberChalkDarkGreen',
    name: 'LT Dark Green Finish',
    price: 1210,
    description: 'Dark-green LT carbon-fiber weave finish with rich forest depth.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberChalkDarkGreen
  },
  {
    id: 'finish-carbonFiberChalkDarkYellow',
    type: 'tableFinish',
    optionId: 'carbonFiberChalkDarkYellow',
    name: 'LT Dark Yellow Finish',
    price: 1220,
    description: 'Dark-yellow LT carbon-fiber weave finish with mustard-gold warmth.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberChalkDarkYellow
  },
  {
    id: 'finish-carbonFiberChalkDarkBrown',
    type: 'tableFinish',
    optionId: 'carbonFiberChalkDarkBrown',
    name: 'LT Dark Brown Finish',
    price: 1230,
    description: 'Dark-brown LT carbon-fiber weave finish with earthy depth.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberChalkDarkBrown
  },
  {
    id: 'finish-carbonFiberChalkDarkRed',
    type: 'tableFinish',
    optionId: 'carbonFiberChalkDarkRed',
    name: 'LT Dark Red Finish',
    price: 1240,
    description: 'Dark-red LT carbon-fiber weave finish with deep crimson character.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberChalkDarkRed
  },
  {
    id: 'finish-carbonFiberAlligatorOlive',
    type: 'tableFinish',
    optionId: 'carbonFiberAlligatorOlive',
    name: 'LT Olive Alligator Finish',
    price: 1310,
    description: 'Olive LT alligator-scale texture with natural reptile tone transitions.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberAlligatorOlive
  },
  {
    id: 'finish-carbonFiberAlligatorSwamp',
    type: 'tableFinish',
    optionId: 'carbonFiberAlligatorSwamp',
    name: 'LT Swamp Alligator Finish',
    price: 1320,
    description: 'Swamp-green LT alligator texture tuned to deep marsh tones.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberAlligatorSwamp
  },
  {
    id: 'finish-carbonFiberAlligatorClay',
    type: 'tableFinish',
    optionId: 'carbonFiberAlligatorClay',
    name: 'LT Clay Alligator Finish',
    price: 1330,
    description: 'Clay-brown LT alligator pattern with warm hide-inspired contrast.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberAlligatorClay
  },
  {
    id: 'finish-carbonFiberAlligatorSand',
    type: 'tableFinish',
    optionId: 'carbonFiberAlligatorSand',
    name: 'LT Sand Alligator Finish',
    price: 1340,
    description: 'Sand LT alligator scales with brighter khaki highlights.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberAlligatorSand
  },
  {
    id: 'finish-carbonFiberAlligatorMoss',
    type: 'tableFinish',
    optionId: 'carbonFiberAlligatorMoss',
    name: 'LT Moss Alligator Finish',
    price: 1350,
    description: 'Moss LT alligator texture balancing olive and slate greens.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberAlligatorMoss
  },
  {
    id: 'finish-carbonFiberAlligatorNight',
    type: 'tableFinish',
    optionId: 'carbonFiberAlligatorNight',
    name: 'LT Night Alligator Finish',
    price: 1360,
    description: 'Night LT alligator scales with muted charcoal-green depth.',
    thumbnail: TABLE_FINISH_THUMBNAILS.carbonFiberAlligatorNight
  },
  {
    id: 'chrome-chrome',
    type: 'chromeColor',
    optionId: 'chrome',
    name: 'Mirror Chrome Fascias',
    price: 360,
    description: 'Polished chrome plates to swap in for the fascia set.',
    thumbnail: swatchThumbnail(['#e2e8f0', '#94a3b8', '#f8fafc'])
  },
  {
    id: 'railMarkers-pearl',
    type: 'railMarkerColor',
    optionId: 'pearl',
    name: 'Pearl Diamonds',
    price: 280,
    description: 'Pearlescent diamond markers with soft sheen.',
    thumbnail: swatchThumbnail(['#f8fafc', '#cbd5f5', '#e2e8f0'])
  },
  {
    id: 'railMarkers-chrome',
    type: 'railMarkerColor',
    optionId: 'chrome',
    name: 'Chrome Diamonds',
    price: 240,
    description: 'Chrome-lined diamond markers that match fascia shine.',
    thumbnail: swatchThumbnail(['#e2e8f0', '#94a3b8', '#f8fafc'])
  },
  ...POOL_ROYALE_CLOTH_VARIANTS.map((variant) => ({
    id: `cloth-${variant.id}`,
    type: 'clothColor',
    optionId: variant.id,
    name: variant.name,
    price: variant.price,
    description: variant.description,
    thumbnail: variant.thumbnail
  })),
  {
    id: 'training-attempts-1',
    type: 'poolTrainingAttempt',
    optionId: '1',
    name: 'Training Attempts · 1 Heart',
    price: 100,
    description: 'Adds 1 Pool Royale training attempt to your attempt bank instantly.',
    thumbnail: swatchThumbnail(['#fb7185', '#fecdd3', '#881337'])
  },
  {
    id: 'training-attempts-5',
    type: 'poolTrainingAttempt',
    optionId: '5',
    name: 'Training Attempts · 5 Hearts',
    price: 450,
    description: 'Adds 5 Pool Royale training attempts to your attempt bank instantly.',
    thumbnail: swatchThumbnail(['#f43f5e', '#fda4af', '#9f1239'])
  },
  {
    id: 'training-attempts-12',
    type: 'poolTrainingAttempt',
    optionId: '12',
    name: 'Training Attempts · 12 Hearts',
    price: 960,
    description: 'Adds 12 Pool Royale training attempts to your attempt bank instantly.',
    thumbnail: swatchThumbnail(['#e11d48', '#fecdd3', '#4c0519'])
  },
  {
    id: 'training-attempts-30',
    type: 'poolTrainingAttempt',
    optionId: '30',
    name: 'Training Attempts · 30 Hearts',
    price: 2100,
    description: 'Adds 30 Pool Royale training attempts to your attempt bank instantly.',
    thumbnail: swatchThumbnail(['#be123c', '#fda4af', '#3f0f1f'])
  },
  {
    id: 'pocket-plastic-black',
    type: 'pocketLiner',
    optionId: 'plastic-black',
    name: 'Plastic Black Pocket Jaws',
    price: 520,
    description: 'Matte black monoblock plastic jaws with subtle molded sheen.',
    thumbnail: POCKET_LINER_THUMBNAILS['plastic-black']
  },
  {
    id: 'pocket-plastic-dark-grey',
    type: 'pocketLiner',
    optionId: 'plastic-dark-grey',
    name: 'Plastic Dark Grey Pocket Jaws',
    price: 530,
    description: 'Charcoal plastic jaws that match the Murlan Royale monoblock finish.',
    thumbnail: POCKET_LINER_THUMBNAILS['plastic-dark-grey']
  },
  {
    id: 'pocket-plastic-grey',
    type: 'pocketLiner',
    optionId: 'plastic-grey',
    name: 'Plastic Grey Pocket Jaws',
    price: 540,
    description: 'Balanced mid-grey plastic jaws with a soft molded texture.',
    thumbnail: POCKET_LINER_THUMBNAILS['plastic-grey']
  },
  {
    id: 'pocket-plastic-light-grey',
    type: 'pocketLiner',
    optionId: 'plastic-light-grey',
    name: 'Plastic Light Grey Pocket Jaws',
    price: 560,
    description: 'Light grey plastic jaws with a crisp monoblock finish.',
    thumbnail: POCKET_LINER_THUMBNAILS['plastic-light-grey']
  },
  {
    id: 'pocket-plastic-magnolia',
    type: 'pocketLiner',
    optionId: 'plastic-magnolia',
    name: 'Plastic Magnolia Pocket Jaws',
    price: 590,
    description: 'Warm magnolia plastic jaws inspired by Murlan Royale seating.',
    thumbnail: POCKET_LINER_THUMBNAILS['plastic-magnolia']
  },
  {
    id: 'cue-redwood',
    type: 'cueStyle',
    optionId: 'redwood-ember',
    name: 'Redwood Ember Cue',
    price: 310,
    description: 'Rich redwood cue butt with ember accents.',
    thumbnail: CUE_STYLE_THUMBNAILS['redwood-ember']
  },
  {
    id: 'cue-wenge',
    type: 'cueStyle',
    optionId: 'wenge-nightfall',
    name: 'Wenge Nightfall Cue',
    price: 340,
    description: 'Deep wenge finish with high-contrast stripes.',
    thumbnail: CUE_STYLE_THUMBNAILS['wenge-nightfall']
  },
  {
    id: 'cue-mahogany',
    type: 'cueStyle',
    optionId: 'mahogany-heritage',
    name: 'Mahogany Heritage Cue',
    price: 325,
    description: 'Classic mahogany cue with heritage grain highlights.',
    thumbnail: CUE_STYLE_THUMBNAILS['mahogany-heritage']
  },
  {
    id: 'cue-walnut',
    type: 'cueStyle',
    optionId: 'walnut-satin',
    name: 'Walnut Satin Cue',
    price: 295,
    description: 'Satin walnut cue butt with balanced contrast.',
    thumbnail: CUE_STYLE_THUMBNAILS['walnut-satin']
  },
  {
    id: 'cue-carbon',
    type: 'cueStyle',
    optionId: 'carbon-matrix',
    name: 'Carbon Matrix Cue',
    price: 380,
    description: 'Carbon fiber cue with metallic weave highlights.',
    thumbnail: CUE_STYLE_THUMBNAILS['carbon-matrix']
  },
  {
    id: 'cue-maple',
    type: 'cueStyle',
    optionId: 'maple-horizon',
    name: 'Maple Horizon Cue',
    price: 300,
    description: 'Bright maple cue with horizon banding.',
    thumbnail: CUE_STYLE_THUMBNAILS['maple-horizon']
  },
  {
    id: 'cue-graphite',
    type: 'cueStyle',
    optionId: 'graphite-aurora',
    name: 'Graphite Aurora Cue',
    price: 360,
    description: 'Graphite weave cue with aurora-inspired tint.',
    thumbnail: CUE_STYLE_THUMBNAILS['graphite-aurora']
  },
  ...POOL_ROYALE_BASE_VARIANTS.map((variant) => ({
    id: `base-${variant.id}`,
    type: 'tableBase',
    optionId: variant.id,
    name: `${variant.name} Base`,
    price: 0,
    description: variant.description,
    thumbnail: BASE_VARIANT_THUMBNAILS[variant.id]
  })),
  ...POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
    id: `hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price,
    description: variant.description,
    thumbnail: variant.thumbnail
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
  { type: 'pocketLiner', optionId: 'plastic-black', label: 'Plastic Black Pocket Jaws' },
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
