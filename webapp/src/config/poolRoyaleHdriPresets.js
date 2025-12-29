export const DEFAULT_POOL_HDRI_ID = 'neon-photostudio';

export const POOL_ROYALE_HDRI_OPTIONS = Object.freeze([
  {
    id: 'neon-photostudio',
    name: 'Neon Photostudio',
    assetId: 'neon_photostudio',
    description: 'Vibrant neon reflections with crisp floor polish for showcase matches.',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    exposure: 1.18,
    environmentIntensity: 1.28,
    backgroundIntensity: 1.12,
    backgroundBlurriness: 0.14,
    swatches: ['#1f2937', '#0ea5e9'],
    price: 1280
  },
  {
    id: 'studio-small-08',
    name: 'Studio Small 08',
    assetId: 'studio_small_08',
    description: 'Soft box studio wrap with controlled highlights for product-like shots.',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    exposure: 1.12,
    environmentIntensity: 1.18,
    backgroundIntensity: 1.04,
    backgroundBlurriness: 0.12,
    swatches: ['#f8fafc', '#e2e8f0'],
    price: 1320
  },
  {
    id: 'venice-sunset',
    name: 'Venice Sunset Lagoon',
    assetId: 'venice_sunset',
    description: 'Golden canal reflections that bathe the table in warm evening light.',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    exposure: 1.16,
    environmentIntensity: 1.22,
    backgroundIntensity: 1.16,
    backgroundBlurriness: 0.1,
    swatches: ['#f97316', '#7c2d12'],
    price: 1360
  },
  {
    id: 'kiara-dawn',
    name: 'Kiara Dawn Ridge',
    assetId: 'kiara_1_dawn',
    description: 'Sunrise hillside with clear skylight for bright, even practice lighting.',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    exposure: 1.14,
    environmentIntensity: 1.2,
    backgroundIntensity: 1.1,
    backgroundBlurriness: 0.08,
    swatches: ['#38bdf8', '#fde68a'],
    price: 1380
  },
  {
    id: 'dikhololo-night',
    name: 'Dikhololo Night Safari',
    assetId: 'dikhololo_night',
    description: 'Moody moonlit dome that leans on HDRI contrast for noir highlight rolls.',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    exposure: 1.24,
    environmentIntensity: 1.32,
    backgroundIntensity: 1.22,
    backgroundBlurriness: 0.18,
    swatches: ['#0b132b', '#1e293b'],
    price: 1420
  },
  {
    id: 'royal-esplanade',
    name: 'Royal Esplanade',
    assetId: 'royal_esplanade',
    description: 'Architectural pavilion with symmetrical bounce for premium specular control.',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    exposure: 1.2,
    environmentIntensity: 1.26,
    backgroundIntensity: 1.14,
    backgroundBlurriness: 0.12,
    swatches: ['#cbd5e1', '#475569'],
    price: 1440
  },
  {
    id: 'potsdamer-platz',
    name: 'Potsdamer Platz',
    assetId: 'potsdamer_platz',
    description: 'City canyons with tall glass facades for dramatic chrome reflections.',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    exposure: 1.22,
    environmentIntensity: 1.3,
    backgroundIntensity: 1.18,
    backgroundBlurriness: 0.1,
    swatches: ['#0f172a', '#38bdf8'],
    price: 1480
  },
  {
    id: 'cayley-interior',
    name: 'Cayley Studio Loft',
    assetId: 'cayley_interior',
    description: 'Open-plan loft with skylights tuned for neutral cloth color accuracy.',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    exposure: 1.15,
    environmentIntensity: 1.24,
    backgroundIntensity: 1.1,
    backgroundBlurriness: 0.09,
    swatches: ['#f3f4f6', '#9ca3af'],
    price: 1500
  },
  {
    id: 'st-fagans-gallery',
    name: 'St Fagans Gallery',
    assetId: 'st_fagans_interior',
    description: 'Museum-grade uplight with soft wall spill for exhibition-style matches.',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    exposure: 1.18,
    environmentIntensity: 1.25,
    backgroundIntensity: 1.12,
    backgroundBlurriness: 0.11,
    swatches: ['#e5e7eb', '#6b7280'],
    price: 1540
  },
  {
    id: 'kloofendal-clouds',
    name: 'Kloofendal Clouds',
    assetId: 'kloofendal_48d_partly_cloudy',
    description: 'High-altitude clouds with clean skylight gradients for competition broadcasts.',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    exposure: 1.16,
    environmentIntensity: 1.22,
    backgroundIntensity: 1.1,
    backgroundBlurriness: 0.08,
    swatches: ['#bfdbfe', '#e5e7eb'],
    price: 1580
  }
]);

export const HDRI_OPTION_MAP = POOL_ROYALE_HDRI_OPTIONS.reduce((acc, option) => {
  acc[option.id] = option;
  return acc;
}, {});
