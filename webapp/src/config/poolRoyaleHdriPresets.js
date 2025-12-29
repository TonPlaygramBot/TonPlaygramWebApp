const DEFAULT_RESOLUTION_ORDER = Object.freeze(['4k', '2k', '1k']);

export const POOL_ROYALE_HDRI_PRESETS = Object.freeze([
  {
    id: 'neon-photostudio',
    name: 'Neon Photostudio',
    assetId: 'neon_photostudio',
    description: 'Vibrant neon cove lights with tight falloff around the table.',
    storeDescription: 'Signature neon stage built for reflective chrome trims and bright cloth colors.',
    storePrice: 1650,
    preferredResolutions: DEFAULT_RESOLUTION_ORDER,
    fallbackResolution: '4k',
    exposure: 1.28,
    envMapIntensity: 1.16
  },
  {
    id: 'studio-small-08',
    name: 'Studio Stage 08',
    assetId: 'studio_small_08',
    description: 'Softbox studio bowl with even tone for competition broadcasts.',
    storeDescription: 'Balanced TV studio bowl that keeps the cloth evenly exposed for streams.',
    storePrice: 1680,
    preferredResolutions: DEFAULT_RESOLUTION_ORDER,
    fallbackResolution: '4k',
    exposure: 1.24,
    envMapIntensity: 1.12
  },
  {
    id: 'brown-photostudio-02',
    name: 'Bronze Photostudio',
    assetId: 'brown_photostudio_02',
    description: 'Warm, controlled bronze bounce that flatters wood grains.',
    storeDescription: 'Cinematic bronze studio that pairs perfectly with amber or walnut finishes.',
    storePrice: 1720,
    preferredResolutions: DEFAULT_RESOLUTION_ORDER,
    fallbackResolution: '4k',
    exposure: 1.26,
    envMapIntensity: 1.14
  },
  {
    id: 'industrial-sunset',
    name: 'Industrial Sunset',
    assetId: 'industrial_sunset_puresky',
    description: 'High-contrast sunset sky with crisp rim and metal highlights.',
    storeDescription: 'Sunset-grade HDRI for dramatic chrome reflections and silhouette shots.',
    storePrice: 1780,
    preferredResolutions: DEFAULT_RESOLUTION_ORDER,
    fallbackResolution: '4k',
    exposure: 1.18,
    envMapIntensity: 1.22
  },
  {
    id: 'dikhololo-night',
    name: 'Dikhololo Night',
    assetId: 'dikhololo_night',
    description: 'Moody night park lighting with cool top-down ambience.',
    storeDescription: 'Nighttime park sky to showcase glowing markers and chrome fascias.',
    storePrice: 1820,
    preferredResolutions: DEFAULT_RESOLUTION_ORDER,
    fallbackResolution: '4k',
    exposure: 1.32,
    envMapIntensity: 1.26
  },
  {
    id: 'kloofendal-partly-cloudy',
    name: 'Kloofendal Clouds',
    assetId: 'kloofendal_48d_partly_cloudy',
    description: 'Open-air daylight with soft clouds for neutral match coverage.',
    storeDescription: 'Outdoor daylight dome with soft clouds for neutral, competition-ready light.',
    storePrice: 1750,
    preferredResolutions: DEFAULT_RESOLUTION_ORDER,
    fallbackResolution: '4k',
    exposure: 1.22,
    envMapIntensity: 1.15
  },
  {
    id: 'rooitou-park',
    name: 'Rooitou Park',
    assetId: 'rooitou_park',
    description: 'Lush green park reflections that accent emerald cloths.',
    storeDescription: 'Bright park ambience that keeps greens vibrant and chrome clean.',
    storePrice: 1720,
    preferredResolutions: DEFAULT_RESOLUTION_ORDER,
    fallbackResolution: '4k',
    exposure: 1.25,
    envMapIntensity: 1.18
  },
  {
    id: 'spruit-sunrise',
    name: 'Spruit Sunrise',
    assetId: 'spruit_sunrise',
    description: 'Golden-hour sun for cinematic rim highlights on rails.',
    storeDescription: 'Sunrise glow with warm rims and deep floor gradients for hero shots.',
    storePrice: 1880,
    preferredResolutions: DEFAULT_RESOLUTION_ORDER,
    fallbackResolution: '4k',
    exposure: 1.2,
    envMapIntensity: 1.24
  },
  {
    id: 'forest-slope',
    name: 'Forest Slope',
    assetId: 'forest_slope',
    description: 'Tree-lined hillside ambience with soft green bounce.',
    storeDescription: 'Natural forest surround that grounds the table without harsh hotspots.',
    storePrice: 1740,
    preferredResolutions: DEFAULT_RESOLUTION_ORDER,
    fallbackResolution: '4k',
    exposure: 1.23,
    envMapIntensity: 1.17
  },
  {
    id: 'barcelona-rooftop',
    name: 'Barcelona Rooftop',
    assetId: 'barcelona_rooftop',
    description: 'Urban rooftop skyline with balanced late-afternoon warmth.',
    storeDescription: 'Premium cityscape HDRI for polished chrome and glass reflections.',
    storePrice: 1800,
    preferredResolutions: DEFAULT_RESOLUTION_ORDER,
    fallbackResolution: '4k',
    exposure: 1.21,
    envMapIntensity: 1.19
  }
]);

export const DEFAULT_POOL_HDRI_ID = 'neon-photostudio';

export const POOL_ROYALE_HDRI_LABELS = Object.freeze(
  POOL_ROYALE_HDRI_PRESETS.reduce((acc, preset) => {
    acc[preset.id] = preset.name;
    return acc;
  }, {})
);

export function findPoolHdriPreset(id) {
  const preset =
    POOL_ROYALE_HDRI_PRESETS.find((entry) => entry.id === id) ??
    POOL_ROYALE_HDRI_PRESETS.find((entry) => entry.id === DEFAULT_POOL_HDRI_ID) ??
    POOL_ROYALE_HDRI_PRESETS[0];
  return preset;
}
