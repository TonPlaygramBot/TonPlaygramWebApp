const AIR_HOCKEY_HDRI_PLACEMENTS = Object.freeze({
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

const RAW_AIR_HOCKEY_HDRI_VARIANTS = [
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
  }
];

const HDRI_RESOLUTION_STACK = Object.freeze(['4k']);

const AIR_HOCKEY_HDRI_VARIANTS = Object.freeze(
  RAW_AIR_HOCKEY_HDRI_VARIANTS.map((variant) => ({
    ...variant,
    preferredResolutions: HDRI_RESOLUTION_STACK,
    ...(AIR_HOCKEY_HDRI_PLACEMENTS[variant.id] || {})
  }))
);

const AIR_HOCKEY_TABLE_FINISHES = Object.freeze([
  Object.freeze({
    id: 'peelingPaintWeathered',
    name: 'Wood Peeling Paint Weathered',
    wood: '#b8b3aa',
    trim: '#d6d0c7',
    swatches: ['#a89f95', '#b8b3aa'],
    price: 980,
    woodTextureId: 'wood_peeling_paint_weathered',
    description: 'Weathered peeling paint wood rails with a reclaimed finish.'
  }),
  Object.freeze({
    id: 'oakVeneer01',
    name: 'Oak Veneer 01',
    wood: '#c89a64',
    trim: '#e0bb7a',
    swatches: ['#b9854e', '#c89a64'],
    price: 990,
    woodTextureId: 'oak_veneer_01',
    description: 'Warm oak veneer rails with smooth satin polish.'
  }),
  Object.freeze({
    id: 'woodTable001',
    name: 'Wood Table 001',
    wood: '#a4724f',
    trim: '#c89a64',
    swatches: ['#8f6243', '#a4724f'],
    price: 1000,
    woodTextureId: 'wood_table_001',
    description: 'Balanced walnut-brown rails inspired by classic table slabs.'
  }),
  Object.freeze({
    id: 'darkWood',
    name: 'Dark Wood',
    wood: '#3d2f2a',
    trim: '#6a5a52',
    swatches: ['#2f241f', '#3d2f2a'],
    price: 1010,
    woodTextureId: 'dark_wood',
    description: 'Deep espresso rails with strong grain contrast.'
  }),
  Object.freeze({
    id: 'rosewoodVeneer01',
    name: 'Rosewood Veneer 01',
    wood: '#6f3a2f',
    trim: '#9b5a44',
    swatches: ['#5b2f26', '#6f3a2f'],
    price: 1020,
    woodTextureId: 'rosewood_veneer_01',
    description: 'Rosewood veneer rails with rich, reddish undertones.'
  })
]);

const AIR_HOCKEY_TABLE_BASES = Object.freeze([
  Object.freeze({
    id: 'classicCylinders',
    name: 'Classic Cylinders',
    description: 'Rounded skirt with six cylinder legs and subtle foot pads.',
    base: '#8f6243',
    accent: '#6f3a2f',
    swatches: ['#8f6243', '#6f3a2f']
  }),
  Object.freeze({
    id: 'openPortal',
    name: 'Open Portal',
    description: 'Twin portal legs with angled sides and negative space.',
    base: '#f8fafc',
    accent: '#e5e7eb',
    swatches: ['#f8fafc', '#e5e7eb']
  }),
  Object.freeze({
    id: 'coffeeTableRound01',
    name: 'Coffee Table Round 01 Base',
    description: 'Rounded Poly Haven coffee table legs tucked beneath the pool table.',
    base: '#c5a47e',
    accent: '#7a5534',
    swatches: ['#c5a47e', '#7a5534']
  }),
  Object.freeze({
    id: 'gothicCoffeeTable',
    name: 'Gothic Coffee Table Base',
    description: 'Gothic coffee table from Murlan Royale re-used as a sculpted support base.',
    base: '#8f4a2b',
    accent: '#3b2a1f',
    swatches: ['#8f4a2b', '#3b2a1f']
  }),
  Object.freeze({
    id: 'woodenTable02Alt',
    name: 'Wooden Table 02 Alt Base',
    description: 'Alternate Wooden Table 02 variant resized to cradle the pool playfield.',
    base: '#6f5140',
    accent: '#caa07a',
    swatches: ['#6f5140', '#caa07a']
  })
]);

export const AIR_HOCKEY_CUSTOMIZATION = Object.freeze({
  field: Object.freeze([
    Object.freeze({
      id: 'auroraIce',
      name: 'Aurora Ice',
      surface: '#3b83c3',
      lines: '#ffffff',
      rings: '#d8f3ff'
    }),
    Object.freeze({
      id: 'neonNight',
      name: 'Neon Night',
      surface: '#152238',
      lines: '#4de1ff',
      rings: '#9bf1ff'
    }),
    Object.freeze({
      id: 'sunsetClash',
      name: 'Sunset Clash',
      surface: '#c93f4b',
      lines: '#ffe8d0',
      rings: '#ffd1a1'
    }),
    Object.freeze({
      id: 'midnightSteel',
      name: 'Midnight Steel',
      surface: '#0f172a',
      lines: '#a1a1aa',
      rings: '#d4d4d8'
    }),
    Object.freeze({
      id: 'mintRush',
      name: 'Mint Rush',
      surface: '#0f766e',
      lines: '#d1fae5',
      rings: '#34d399'
    })
  ]),
  table: AIR_HOCKEY_TABLE_FINISHES,
  tableBase: AIR_HOCKEY_TABLE_BASES,
  environmentHdri: AIR_HOCKEY_HDRI_VARIANTS,
  puck: Object.freeze([
    Object.freeze({ id: 'carbon', name: 'Carbon', color: '#111111', emissive: '#1f2937' }),
    Object.freeze({ id: 'volt', name: 'Volt', color: '#eab308', emissive: '#854d0e' }),
    Object.freeze({ id: 'magenta', name: 'Magenta', color: '#be185d', emissive: '#9f1239' }),
    Object.freeze({ id: 'frost', name: 'Frost', color: '#e0f2fe', emissive: '#0ea5e9' }),
    Object.freeze({ id: 'jade', name: 'Jade', color: '#064e3b', emissive: '#10b981' })
  ]),
  mallet: Object.freeze([
    Object.freeze({ id: 'crimson', name: 'Crimson', color: '#ff5577', knob: '#1f2937' }),
    Object.freeze({ id: 'cyan', name: 'Cyan', color: '#22d3ee', knob: '#0f172a' }),
    Object.freeze({ id: 'amber', name: 'Amber', color: '#f59e0b', knob: '#451a03' }),
    Object.freeze({ id: 'violet', name: 'Violet', color: '#a855f7', knob: '#312e81' }),
    Object.freeze({ id: 'lime', name: 'Lime', color: '#84cc16', knob: '#1a2e05' })
  ]),
  rails: Object.freeze([
    Object.freeze({ id: 'woodenRails', name: 'Wooden Rails', color: '#8f6243', opacity: 1 })
  ]),
  goals: Object.freeze([
    Object.freeze({ id: 'mintNet', name: 'Mint Net', color: '#99ffd6', emissive: '#1aaf80' }),
    Object.freeze({ id: 'crimsonNet', name: 'Crimson Net', color: '#ef4444', emissive: '#7f1d1d' }),
    Object.freeze({ id: 'cobaltNet', name: 'Cobalt Net', color: '#60a5fa', emissive: '#1d4ed8' }),
    Object.freeze({ id: 'amberNet', name: 'Amber Net', color: '#f59e0b', emissive: '#92400e' }),
    Object.freeze({ id: 'ghostNet', name: 'Ghost Net', color: '#e5e7eb', emissive: '#6b7280' })
  ])
});

const firstIds = Object.fromEntries(
  Object.entries(AIR_HOCKEY_CUSTOMIZATION).map(([key, options]) => [key, options?.[0]?.id])
);

export const AIR_HOCKEY_DEFAULT_UNLOCKS = Object.freeze(
  Object.entries(firstIds).reduce((acc, [key, id]) => {
    acc[key] = id ? [id] : [];
    return acc;
  }, {})
);

export const AIR_HOCKEY_OPTION_LABELS = Object.freeze(
  Object.entries(AIR_HOCKEY_CUSTOMIZATION).reduce((acc, [key, options]) => {
    acc[key] = Object.freeze(
      options.reduce((map, option) => {
        map[option.id] = option.name;
        return map;
      }, {})
    );
    return acc;
  }, {})
);

export const AIR_HOCKEY_STORE_ITEMS = [
  { id: 'field-neonNight', type: 'field', optionId: 'neonNight', name: 'Neon Night Rink', price: 480, description: 'Electric cyan lines on a dark rink glow.' },
  { id: 'field-sunsetClash', type: 'field', optionId: 'sunsetClash', name: 'Sunset Clash Rink', price: 520, description: 'Warm sunset cloth with soft ivory lines.' },
  { id: 'field-midnightSteel', type: 'field', optionId: 'midnightSteel', name: 'Midnight Steel Rink', price: 560, description: 'Slate midnight tones with metallic accents.' },
  { id: 'field-mintRush', type: 'field', optionId: 'mintRush', name: 'Mint Rush Rink', price: 600, description: 'Mint-emerald surface with bright rings.' },
  ...AIR_HOCKEY_TABLE_FINISHES.map((finish) => ({
    id: `finish-${finish.id}`,
    type: 'table',
    optionId: finish.id,
    name: `${finish.name} Finish`,
    price: finish.price,
    description: finish.description
  })),
  { id: 'puck-volt', type: 'puck', optionId: 'volt', name: 'Volt Puck', price: 220, description: 'High-voltage yellow puck glow.' },
  { id: 'puck-magenta', type: 'puck', optionId: 'magenta', name: 'Magenta Puck', price: 240, description: 'Magenta puck with vivid emissive edge.' },
  { id: 'puck-frost', type: 'puck', optionId: 'frost', name: 'Frost Puck', price: 260, description: 'Frost-white puck with cyan glow.' },
  { id: 'puck-jade', type: 'puck', optionId: 'jade', name: 'Jade Puck', price: 280, description: 'Deep jade puck with emerald shine.' },
  { id: 'mallet-cyan', type: 'mallet', optionId: 'cyan', name: 'Cyan Mallets', price: 260, description: 'Cyan mallets with midnight knobs.' },
  { id: 'mallet-amber', type: 'mallet', optionId: 'amber', name: 'Amber Mallets', price: 280, description: 'Amber mallets with dark wood knobs.' },
  { id: 'mallet-violet', type: 'mallet', optionId: 'violet', name: 'Violet Mallets', price: 300, description: 'Violet mallets with indigo knobs.' },
  { id: 'mallet-lime', type: 'mallet', optionId: 'lime', name: 'Lime Mallets', price: 320, description: 'Lime mallets with forest knobs.' },
  { id: 'rails-wooden', type: 'rails', optionId: 'woodenRails', name: 'Wooden Rails', price: 0, description: 'Solid wood rails fitted inside the Pool Royale frame.' },
  { id: 'goal-crimson', type: 'goals', optionId: 'crimsonNet', name: 'Crimson Net Goals', price: 330, description: 'Crimson goal nets with deep ember glow.' },
  { id: 'goal-cobalt', type: 'goals', optionId: 'cobaltNet', name: 'Cobalt Net Goals', price: 360, description: 'Cobalt nets with electric blue emissive.' },
  { id: 'goal-amber', type: 'goals', optionId: 'amberNet', name: 'Amber Net Goals', price: 390, description: 'Amber nets with warm metallic shine.' },
  { id: 'goal-ghost', type: 'goals', optionId: 'ghostNet', name: 'Ghost Net Goals', price: 420, description: 'Ghostly pale nets with steel glow.' },
  ...AIR_HOCKEY_TABLE_BASES.map((variant) => ({
    id: `base-${variant.id}`,
    type: 'tableBase',
    optionId: variant.id,
    name: `${variant.name} Base`,
    price: 0,
    description: variant.description
  })),
  ...AIR_HOCKEY_HDRI_VARIANTS.map((variant) => ({
    id: `hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price,
    description: variant.description
  }))
];

export const AIR_HOCKEY_DEFAULT_LOADOUT = [
  { type: 'field', optionId: AIR_HOCKEY_CUSTOMIZATION.field[0].id, label: AIR_HOCKEY_CUSTOMIZATION.field[0].name },
  { type: 'table', optionId: AIR_HOCKEY_CUSTOMIZATION.table[0].id, label: AIR_HOCKEY_CUSTOMIZATION.table[0].name },
  { type: 'tableBase', optionId: AIR_HOCKEY_CUSTOMIZATION.tableBase[0].id, label: AIR_HOCKEY_CUSTOMIZATION.tableBase[0].name },
  { type: 'environmentHdri', optionId: AIR_HOCKEY_CUSTOMIZATION.environmentHdri[0].id, label: AIR_HOCKEY_CUSTOMIZATION.environmentHdri[0].name },
  { type: 'puck', optionId: AIR_HOCKEY_CUSTOMIZATION.puck[0].id, label: AIR_HOCKEY_CUSTOMIZATION.puck[0].name },
  { type: 'mallet', optionId: AIR_HOCKEY_CUSTOMIZATION.mallet[0].id, label: AIR_HOCKEY_CUSTOMIZATION.mallet[0].name },
  { type: 'rails', optionId: AIR_HOCKEY_CUSTOMIZATION.rails[0].id, label: AIR_HOCKEY_CUSTOMIZATION.rails[0].name },
  { type: 'goals', optionId: AIR_HOCKEY_CUSTOMIZATION.goals[0].id, label: AIR_HOCKEY_CUSTOMIZATION.goals[0].name }
];
