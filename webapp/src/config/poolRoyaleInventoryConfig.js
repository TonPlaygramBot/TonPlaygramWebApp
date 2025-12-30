import { POOL_ROYALE_CLOTH_VARIANTS } from './poolRoyaleClothPresets.js';

const POOL_ROYALE_HDRI_PLACEMENTS = Object.freeze({
  neonPhotostudio: { cameraHeightM: 1.52, groundRadiusMultiplier: 3.8, groundResolution: 120 },
  studioSoftbox08: { cameraHeightM: 1.52, groundRadiusMultiplier: 3.7, groundResolution: 120 },
  bronzePhotostudio: { cameraHeightM: 1.54, groundRadiusMultiplier: 3.9, groundResolution: 120 },
  adamsBridge: { cameraHeightM: 1.68, groundRadiusMultiplier: 6.5, groundResolution: 112 },
  veniceSunset: { cameraHeightM: 1.68, groundRadiusMultiplier: 6.7, groundResolution: 112 },
  modernRooftops: { cameraHeightM: 1.72, groundRadiusMultiplier: 7, groundResolution: 112 },
  kloofendalClouds: { cameraHeightM: 1.66, groundRadiusMultiplier: 6.2, groundResolution: 104 },
  ballroomHall: { cameraHeightM: 1.58, groundRadiusMultiplier: 5.1, groundResolution: 112 },
  rooftopNight: { cameraHeightM: 1.72, groundRadiusMultiplier: 7, groundResolution: 112 },
  industrialSunset: { cameraHeightM: 1.7, groundRadiusMultiplier: 6.3, groundResolution: 112 },
  snookerRoom: { cameraHeightM: 1.5, groundRadiusMultiplier: 4.4, groundResolution: 128 },
  emptyPlayRoom: { cameraHeightM: 1.5, groundRadiusMultiplier: 3.9, groundResolution: 120 },
  christmasPhotoStudio04: { cameraHeightM: 1.52, groundRadiusMultiplier: 3.9, groundResolution: 120 },
  billiardHall: { cameraHeightM: 1.54, groundRadiusMultiplier: 4.8, groundResolution: 128 },
  colorfulStudio: { cameraHeightM: 1.5, groundRadiusMultiplier: 4, groundResolution: 120 },
  dancingHall: { cameraHeightM: 1.58, groundRadiusMultiplier: 5, groundResolution: 112 },
  abandonedHall: { cameraHeightM: 1.6, groundRadiusMultiplier: 5.2, groundResolution: 112 },
  cinemaHall: { cameraHeightM: 1.58, groundRadiusMultiplier: 5, groundResolution: 112 },
  entranceHall: { cameraHeightM: 1.56, groundRadiusMultiplier: 4.8, groundResolution: 112 },
  eventsHallInterior: { cameraHeightM: 1.6, groundRadiusMultiplier: 5.3, groundResolution: 112 },
  hallOfFinfish: { cameraHeightM: 1.6, groundRadiusMultiplier: 5.3, groundResolution: 112 },
  hallOfMammals: { cameraHeightM: 1.6, groundRadiusMultiplier: 5.3, groundResolution: 112 },
  leadenhallMarket: { cameraHeightM: 1.64, groundRadiusMultiplier: 6, groundResolution: 112 },
  marryHall: { cameraHeightM: 1.57, groundRadiusMultiplier: 4.9, groundResolution: 112 },
  mirroredHall: { cameraHeightM: 1.58, groundRadiusMultiplier: 5, groundResolution: 112 },
  musicHall01: { cameraHeightM: 1.6, groundRadiusMultiplier: 5.2, groundResolution: 112 },
  musicHall02: { cameraHeightM: 1.6, groundRadiusMultiplier: 5.2, groundResolution: 112 },
  oldHall: { cameraHeightM: 1.58, groundRadiusMultiplier: 5, groundResolution: 112 },
  broadwayPhotoStudioHall: { cameraHeightM: 1.54, groundRadiusMultiplier: 4.6, groundResolution: 120 },
  loftPhotoStudioHall: { cameraHeightM: 1.54, groundRadiusMultiplier: 4.6, groundResolution: 120 },
  londonPhotoStudioHall: { cameraHeightM: 1.56, groundRadiusMultiplier: 4.8, groundResolution: 120 },
  schoolHall: { cameraHeightM: 1.55, groundRadiusMultiplier: 4.6, groundResolution: 112 },
  countryStudioHall: { cameraHeightM: 1.55, groundRadiusMultiplier: 4.5, groundResolution: 112 },
  arenaGrandstand: { cameraHeightM: 1.6, groundRadiusMultiplier: 5.4, groundResolution: 128 },
  arenaPulse: { cameraHeightM: 1.62, groundRadiusMultiplier: 5.6, groundResolution: 128 },
  arenaMetropolis: { cameraHeightM: 1.64, groundRadiusMultiplier: 5.7, groundResolution: 128 },
  arenaSkybox: { cameraHeightM: 1.6, groundRadiusMultiplier: 5.3, groundResolution: 128 },
  arenaRoyalExpo: { cameraHeightM: 1.58, groundRadiusMultiplier: 5.2, groundResolution: 128 }
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
    id: 'cinemaHall',
    name: 'Cinema Hall',
    assetId: 'cinema_hall',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1880,
    exposure: 1.11,
    environmentIntensity: 1.07,
    backgroundIntensity: 1.02,
    swatches: ['#ef4444', '#111827'],
    description: 'Cinematic auditorium lighting with rich red bounce and aisle glow.'
  },
  {
    id: 'entranceHall',
    name: 'Entrance Hall',
    assetId: 'entrance_hall',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1900,
    exposure: 1.09,
    environmentIntensity: 1.06,
    backgroundIntensity: 1,
    swatches: ['#a3e635', '#22c55e'],
    description: 'Bright lobby ambience with balanced daylight fill and mild speculars.'
  },
  {
    id: 'eventsHallInterior',
    name: 'Events Hall Interior',
    assetId: 'events_hall_interior',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1920,
    exposure: 1.13,
    environmentIntensity: 1.08,
    backgroundIntensity: 1.04,
    swatches: ['#f59e0b', '#f97316'],
    description: 'Warm event hall lighting with chandelier sheen and soft table reflections.'
  },
  {
    id: 'hallOfFinfish',
    name: 'Hall of Finfish',
    assetId: 'hall_of_finfish',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1940,
    exposure: 1.1,
    environmentIntensity: 1.07,
    backgroundIntensity: 1.02,
    swatches: ['#22d3ee', '#2563eb'],
    description: 'Museum hall mood with blue-toned accents and glass case reflections.'
  },
  {
    id: 'hallOfMammals',
    name: 'Hall of Mammals',
    assetId: 'hall_of_mammals',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1960,
    exposure: 1.12,
    environmentIntensity: 1.09,
    backgroundIntensity: 1.03,
    swatches: ['#facc15', '#a16207'],
    description: 'Golden museum ambience with warm diorama bounce and soft roof fill.'
  },
  {
    id: 'leadenhallMarket',
    name: 'Leadenhall Market',
    assetId: 'leadenhall_market',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 1980,
    exposure: 1.14,
    environmentIntensity: 1.12,
    backgroundIntensity: 1.06,
    swatches: ['#a855f7', '#0ea5e9'],
    description: 'Historic market canopy with mixed warm and cool street reflections.'
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
    id: 'musicHall01',
    name: 'Music Hall 01',
    assetId: 'music_hall_01',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2040,
    exposure: 1.09,
    environmentIntensity: 1.06,
    backgroundIntensity: 1.02,
    swatches: ['#0ea5e9', '#9333ea'],
    description: 'Concert hall fill with cool aisle lights and controlled stage bounce.'
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
    id: 'broadwayPhotoStudioHall',
    name: 'Broadway Photo Studio Hall',
    assetId: 'photo_studio_broadway_hall',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2100,
    exposure: 1.13,
    environmentIntensity: 1.09,
    backgroundIntensity: 1.04,
    swatches: ['#f472b6', '#0ea5e9'],
    description: 'Studio hall with bright key lights and saturated accent gels.'
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
    id: 'schoolHall',
    name: 'School Hall',
    assetId: 'school_hall',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2160,
    exposure: 1.07,
    environmentIntensity: 1.05,
    backgroundIntensity: 0.98,
    swatches: ['#22c55e', '#94a3b8'],
    description: 'Clean institutional hall with neutral overhead bounce and even fill.'
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
    id: 'arenaGrandstand',
    name: 'Arena Grandstand',
    assetId: 'billiard_hall',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2220,
    exposure: 1.16,
    environmentIntensity: 1.12,
    backgroundIntensity: 1.06,
    swatches: ['#38bdf8', '#1d4ed8'],
    description: 'Public grandstand arena glow with slow crowd movement and sharp rim light.',
    ambientSoundUrl: '/assets/sounds/football-crowd-3-69245.mp3',
    ambientVolume: 0.26,
    skyboxRotationSpeed: 0.035,
    skyboxRotation: 0.3
  },
  {
    id: 'arenaPulse',
    name: 'Arena Pulse',
    assetId: 'music_hall_02',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2260,
    exposure: 1.18,
    environmentIntensity: 1.14,
    backgroundIntensity: 1.08,
    swatches: ['#f97316', '#db2777'],
    description: 'Neon-lit arena interior with animated light sweeps and bassy ambience.',
    ambientSoundUrl: '/assets/sounds/football-game-sound-effects-359284.mp3',
    ambientVolume: 0.22,
    skyboxRotationSpeed: 0.045,
    skyboxRotation: -0.2
  },
  {
    id: 'arenaMetropolis',
    name: 'Arena Metropolis',
    assetId: 'leadenhall_market',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2300,
    exposure: 1.15,
    environmentIntensity: 1.1,
    backgroundIntensity: 1.04,
    swatches: ['#22d3ee', '#8b5cf6'],
    description: 'Open market arena with public footfall motion and sweeping skylights.',
    ambientSoundUrl: '/assets/sounds/race-care-151963.mp3',
    ambientVolume: 0.2,
    skyboxRotationSpeed: 0.03,
    skyboxRotation: 0.15
  },
  {
    id: 'arenaSkybox',
    name: 'Arena Skybox',
    assetId: 'events_hall_interior',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2340,
    exposure: 1.17,
    environmentIntensity: 1.12,
    backgroundIntensity: 1.06,
    swatches: ['#f59e0b', '#84cc16'],
    description: 'Festival arena canopy with rotating light rigs and open-floor motion.',
    ambientSoundUrl: '/assets/sounds/fireworks-29629.mp3',
    ambientVolume: 0.18,
    skyboxRotationSpeed: 0.04,
    skyboxRotation: 0.45
  },
  {
    id: 'arenaRoyalExpo',
    name: 'Arena Royal Expo',
    assetId: 'ballroom',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    price: 2380,
    exposure: 1.19,
    environmentIntensity: 1.15,
    backgroundIntensity: 1.08,
    swatches: ['#fbbf24', '#f472b6'],
    description: 'Royal exhibition arena with drifting highlights and ceremonial crowd motion.',
    ambientSoundUrl: '/assets/sounds/crowd-cheering-383111.mp3',
    ambientVolume: 0.24,
    skyboxRotationSpeed: 0.032,
    skyboxRotation: -0.35
  }
];

export const POOL_ROYALE_HDRI_VARIANTS = Object.freeze(
  RAW_POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
    ...variant,
    ...(POOL_ROYALE_HDRI_PLACEMENTS[variant.id] || {})
  }))
);

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
