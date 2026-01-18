import { POOL_ROYALE_CLOTH_VARIANTS } from './poolRoyaleClothPresets.js';

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

const HDRI_RESOLUTION_STACK = Object.freeze(['4k', '2k']);

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
  },
  {
    id: 'blenderkitPoolTable',
    name: 'BlenderKit Pool Table Base',
    description: 'BlenderKit pool table model base, fitted to the Pool Royale playfield.',
    swatches: ['#2f7d4d', '#0f3d24'],
    assetBaseId: '30785e01-959c-47a0-8491-9471dd926581'
  }
]);

export const POOL_ROYALE_DEFAULT_HDRI_ID = 'colorfulStudio';

export const POOL_ROYALE_BLENDERKIT_TABLE_FINISHES = Object.freeze([
  {
    id: 'blenderkit-35421bc9',
    label: 'BlenderKit Finish 35421bc9',
    assetBaseId: '35421bc9-a49d-4979-8d93-0c13e9eba371'
  },
  {
    id: 'blenderkit-2c52be7f',
    label: 'BlenderKit Finish 2c52be7f',
    assetBaseId: '2c52be7f-8e46-4c6c-adc2-888449da931e'
  },
  {
    id: 'blenderkit-3ecfdd76',
    label: 'BlenderKit Finish 3ecfdd76',
    assetBaseId: '3ecfdd76-6e15-4c3c-89c9-4a1cafdc3155'
  },
  {
    id: 'blenderkit-f1036f94',
    label: 'BlenderKit Finish f1036f94',
    assetBaseId: 'f1036f94-c4a7-4c70-8694-3234f062d46d'
  },
  {
    id: 'blenderkit-1fddce2a',
    label: 'BlenderKit Finish 1fddce2a',
    assetBaseId: '1fddce2a-4d76-45e4-b09e-e4605e10b873'
  },
  {
    id: 'blenderkit-fb650615',
    label: 'BlenderKit Finish fb650615',
    assetBaseId: 'fb650615-ef11-4e19-bc68-abfbeddee561'
  },
  {
    id: 'blenderkit-852ee40c',
    label: 'BlenderKit Finish 852ee40c',
    assetBaseId: '852ee40c-e967-4028-bb26-428e84933cab'
  },
  {
    id: 'blenderkit-199ebe44',
    label: 'BlenderKit Finish 199ebe44',
    assetBaseId: '199ebe44-46ef-490d-99f6-93aa33b903b8'
  },
  {
    id: 'blenderkit-e25066a1',
    label: 'BlenderKit Finish e25066a1',
    assetBaseId: 'e25066a1-aaba-4ff1-ab68-a67b413c5eaa'
  },
  {
    id: 'blenderkit-a283a837',
    label: 'BlenderKit Finish a283a837',
    assetBaseId: 'a283a837-0e33-4182-b55d-2a8c742fda08'
  },
  {
    id: 'blenderkit-46de7336',
    label: 'BlenderKit Finish 46de7336',
    assetBaseId: '46de7336-6072-4b85-8b99-ac2438829a08'
  },
  {
    id: 'blenderkit-3c4de2d5',
    label: 'BlenderKit Finish 3c4de2d5',
    assetBaseId: '3c4de2d5-540e-4e1c-95dd-9b6721bba08f'
  },
  {
    id: 'blenderkit-22585ff5',
    label: 'BlenderKit Finish 22585ff5',
    assetBaseId: '22585ff5-5c37-42c1-8fbe-be9429c2722b'
  },
  {
    id: 'blenderkit-e4cdf7af',
    label: 'BlenderKit Finish e4cdf7af',
    assetBaseId: 'e4cdf7af-7789-4ef1-85a8-378956ceb79d'
  },
  {
    id: 'blenderkit-fa7dacb7',
    label: 'BlenderKit Finish fa7dacb7',
    assetBaseId: 'fa7dacb7-3621-4c57-ad5b-b4178afc329b'
  },
  {
    id: 'blenderkit-42682664',
    label: 'BlenderKit Finish 42682664',
    assetBaseId: '42682664-0da2-4d09-9d18-e0c7fbc61740'
  },
  {
    id: 'blenderkit-784156cf',
    label: 'BlenderKit Finish 784156cf',
    assetBaseId: '784156cf-8f7a-4559-b388-4cdc66a237c7'
  },
  {
    id: 'blenderkit-87170683',
    label: 'BlenderKit Finish 87170683',
    assetBaseId: '87170683-fda0-4121-b8fd-6a7874a1f060'
  },
  {
    id: 'blenderkit-8f9b1321',
    label: 'BlenderKit Finish 8f9b1321',
    assetBaseId: '8f9b1321-c008-4e8b-bee2-bd71c3d96eca'
  },
  {
    id: 'blenderkit-2a5a3947',
    label: 'BlenderKit Finish 2a5a3947',
    assetBaseId: '2a5a3947-6788-479a-930c-d8e0c46f5444'
  },
  {
    id: 'blenderkit-7bb8b5ff',
    label: 'BlenderKit Finish 7bb8b5ff',
    assetBaseId: '7bb8b5ff-9414-41f6-912e-c7f7c7c199cd'
  },
  {
    id: 'blenderkit-646e4223',
    label: 'BlenderKit Finish 646e4223',
    assetBaseId: '646e4223-0a0e-402c-83cb-771f80cb3b40'
  },
  {
    id: 'blenderkit-739b5e5b',
    label: 'BlenderKit Finish 739b5e5b',
    assetBaseId: '739b5e5b-95a8-43b5-a87f-393e4bf07afa'
  },
  {
    id: 'blenderkit-4abe5330',
    label: 'BlenderKit Finish 4abe5330',
    assetBaseId: '4abe5330-da7c-4297-9769-6e7e0acc8bc3'
  },
  {
    id: 'blenderkit-43baa4e4',
    label: 'BlenderKit Finish 43baa4e4',
    assetBaseId: '43baa4e4-d20b-47c5-949b-a38fa6c15b51'
  },
  {
    id: 'blenderkit-179f3e02',
    label: 'BlenderKit Finish 179f3e02',
    assetBaseId: '179f3e02-a17a-4b7f-8316-3504864282be'
  },
  {
    id: 'blenderkit-42c90503',
    label: 'BlenderKit Finish 42c90503',
    assetBaseId: '42c90503-731b-46b6-a23e-019d06749d3a'
  },
  {
    id: 'blenderkit-a167dd9e',
    label: 'BlenderKit Finish a167dd9e',
    assetBaseId: 'a167dd9e-f0a4-4384-8b81-2fbb87dd1728'
  },
  {
    id: 'blenderkit-7c47beed',
    label: 'BlenderKit Finish 7c47beed',
    assetBaseId: '7c47beed-802f-449e-8db6-1e1a4af162cc'
  },
  {
    id: 'blenderkit-42f8ed87',
    label: 'BlenderKit Finish 42f8ed87',
    assetBaseId: '42f8ed87-4d8b-4e2d-82b3-ec91c4b27231'
  },
  {
    id: 'blenderkit-ec1358d7',
    label: 'BlenderKit Finish ec1358d7',
    assetBaseId: 'ec1358d7-5ea1-47f6-9171-6c57de898739'
  },
  {
    id: 'blenderkit-36a2d185',
    label: 'BlenderKit Finish 36a2d185',
    assetBaseId: '36a2d185-faf0-4949-b473-c9bec980867f'
  },
  {
    id: 'blenderkit-16bcdeeb',
    label: 'BlenderKit Finish 16bcdeeb',
    assetBaseId: '16bcdeeb-ae61-42fa-9f17-ee96ca77a6e5'
  },
  {
    id: 'blenderkit-8e44c701',
    label: 'BlenderKit Finish 8e44c701',
    assetBaseId: '8e44c701-27cd-4d52-be1c-a9a7140354a4'
  },
  {
    id: 'blenderkit-ade0f2da',
    label: 'BlenderKit Finish ade0f2da',
    assetBaseId: 'ade0f2da-ceed-431b-a372-ade7f969a230'
  },
  {
    id: 'blenderkit-17a9260c',
    label: 'BlenderKit Finish 17a9260c',
    assetBaseId: '17a9260c-0355-4e50-b73e-9406e9f642b6'
  },
  {
    id: 'blenderkit-c13bea13',
    label: 'BlenderKit Finish c13bea13',
    assetBaseId: 'c13bea13-d852-4e32-8971-57a7c5c93879'
  },
  {
    id: 'blenderkit-511f0b04',
    label: 'BlenderKit Finish 511f0b04',
    assetBaseId: '511f0b04-dee5-47e2-b789-d518a735ab49'
  },
  {
    id: 'blenderkit-bd1d17c7',
    label: 'BlenderKit Finish bd1d17c7',
    assetBaseId: 'bd1d17c7-ce71-4c9a-89e3-cbadf6fbb67f'
  },
  {
    id: 'blenderkit-77777f54',
    label: 'BlenderKit Finish 77777f54',
    assetBaseId: '77777f54-71c1-4910-b534-3f00e3f9a574'
  },
  {
    id: 'blenderkit-9a4f0337',
    label: 'BlenderKit Finish 9a4f0337',
    assetBaseId: '9a4f0337-b06e-4886-9460-455bf108be8d'
  },
  {
    id: 'blenderkit-f4b039e7',
    label: 'BlenderKit Finish f4b039e7',
    assetBaseId: 'f4b039e7-d4d4-48c2-8799-23b6d8f09716'
  },
  {
    id: 'blenderkit-a8a0525a',
    label: 'BlenderKit Finish a8a0525a',
    assetBaseId: 'a8a0525a-80d4-4e71-9249-4b3114b003bc'
  },
  {
    id: 'blenderkit-1d275ed8',
    label: 'BlenderKit Finish 1d275ed8',
    assetBaseId: '1d275ed8-6c1e-4850-82ad-72e65749ab0b'
  }
]);

export const POOL_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableFinish: ['peelingPaintWeathered'],
  chromeColor: ['gold'],
  railMarkerColor: ['gold'],
  clothColor: [POOL_ROYALE_CLOTH_VARIANTS[0].id],
  cueStyle: ['birch-frost'],
  pocketLiner: ['fabric_leather_02'],
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
    ...POOL_ROYALE_BLENDERKIT_TABLE_FINISHES.reduce((acc, finish) => {
      acc[finish.id] = finish.label;
      return acc;
    }, {})
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
    fabric_leather_02: 'Fabric Leather 02 Pocket Jaws',
    fabric_leather_01: 'Fabric Leather 01 Pocket Jaws',
    brown_leather: 'Brown Leather Pocket Jaws',
    leather_red_02: 'Leather Red 02 Pocket Jaws',
    leather_red_03: 'Leather Red 03 Pocket Jaws',
    leather_white: 'Leather White Pocket Jaws'
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
  ...POOL_ROYALE_BLENDERKIT_TABLE_FINISHES.map((finish) => ({
    id: `finish-${finish.id}`,
    type: 'tableFinish',
    optionId: finish.id,
    name: `${finish.label} Finish`,
    price: 1120,
    description: 'BlenderKit material finish with original texture mapping.'
  })),
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
    id: 'pocket-fabric-leather-02',
    type: 'pocketLiner',
    optionId: 'fabric_leather_02',
    name: 'Fabric Leather 02 Pocket Jaws',
    price: 520,
    description: 'Warm stitched leather weave liners for the classic Pool Royale look.'
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
  { type: 'pocketLiner', optionId: 'fabric_leather_02', label: 'Fabric Leather 02 Pocket Jaws' },
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
