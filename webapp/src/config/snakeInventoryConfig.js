import { POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';
import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';
import { polyHavenThumb, swatchThumbnail } from './storeThumbnails.js';

const mapLabels = (options) =>
  Object.freeze(
    options.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  );

const SNAKE_TABLE_FINISH_OPTIONS = Object.freeze([
  { id: 'peelingPaintWeathered', label: 'Wood Peeling Paint Weathered' },
  { id: 'oakVeneer01', label: 'Oak Veneer 01' },
  { id: 'woodTable001', label: 'Wood Table 001' },
  { id: 'darkWood', label: 'Dark Wood' },
  { id: 'rosewoodVeneer01', label: 'Rosewood Veneer 01' }
]);

const SNAKE_TOKEN_SHAPE_OPTIONS = Object.freeze([
  { id: 'pawn', label: 'Pawn Token' },
  { id: 'knight', label: 'Knight Token' },
  { id: 'bishop', label: 'Bishop Token' },
  { id: 'rook', label: 'Rook Token' },
  { id: 'queen', label: 'Queen Token' },
  { id: 'king', label: 'King Token' }
]);
const SNAKE_CAPTURE_WEAPON_OPTIONS = Object.freeze([
  { id: 'fighter', label: 'Fighter Jet' },
  { id: 'helicopter', label: 'Military Helicopter' },
  { id: 'supportTruck', label: 'Support Truck' },
  { id: 'drone', label: 'Drone' }
]);

export const SNAKE_PAWN_HEAD_OPTIONS = Object.freeze([
  { id: 'current', label: 'Current' },
  { id: 'headRuby', label: 'Ruby' },
  { id: 'headSapphire', label: 'Sapphire' },
  { id: 'headChrome', label: 'Chrome' },
  { id: 'headGold', label: 'Gold' }
]);

export const SNAKE_TOKEN_COLOR_OPTIONS = Object.freeze([
  { id: 'marble', label: 'Marble', color: '#f8fafc' },
  { id: 'darkForest', label: 'Dark Forest', color: '#14532d' },
  { id: 'amberGlow', label: 'Amber Glow', color: '#f59e0b' },
  { id: 'mintVale', label: 'Mint Vale', color: '#10b981' },
  { id: 'royalWave', label: 'Royal Wave', color: '#3b82f6' },
  { id: 'roseMist', label: 'Rose Mist', color: '#ef4444' },
  { id: 'amethyst', label: 'Amethyst', color: '#8b5cf6' },
  { id: 'cinderBlaze', label: 'Cinder Blaze', color: '#ff6b35' },
  { id: 'arcticDrift', label: 'Arctic Drift', color: '#bcd7ff' }
]);

const SNAKE_TABLE_FINISH_THUMBNAILS = Object.freeze({
  peelingPaintWeathered: polyHavenThumb('wood_peeling_paint_weathered'),
  oakVeneer01: polyHavenThumb('oak_veneer_01'),
  woodTable001: polyHavenThumb('wood_table_001'),
  darkWood: polyHavenThumb('dark_wood'),
  rosewoodVeneer01: polyHavenThumb('rosewood_veneer_01')
});

const SNAKE_THEME_THUMBNAILS = Object.freeze({
  arenaTheme: {
    crystalLagoon: swatchThumbnail(['#0ea5e9', '#0f766e', '#99f6e4']),
    royalEmber: swatchThumbnail(['#f97316', '#7c2d12', '#fde68a'])
  },
  boardPalette: {
    glacierGlass: swatchThumbnail(['#38bdf8', '#1d4ed8', '#e0f2fe']),
    jadeSanctum: swatchThumbnail(['#10b981', '#065f46', '#bbf7d0'])
  },
  snakeSkin: {
    midnightCobra: swatchThumbnail(['#1f2937', '#111827', '#c4b5fd']),
    emberSerpent: swatchThumbnail(['#f97316', '#7c2d12', '#fdba74'])
  },
  diceTheme: {
    onyxChrome: swatchThumbnail(['#111827', '#1f2937', '#e5e7eb']),
    auroraQuartz: swatchThumbnail(['#22d3ee', '#a855f7', '#f0abfc'])
  },
  tokenFinish: {
    matteVelvet: swatchThumbnail(['#6b7280', '#1f2937', '#e2e8f0']),
    holographicPulse: swatchThumbnail(['#a855f7', '#22d3ee', '#f0abfc'])
  },
  headStyle: {
    headRuby: swatchThumbnail(['#b91c1c', '#7f1d1d', '#fecaca']),
    headSapphire: swatchThumbnail(['#2563eb', '#1d4ed8', '#bfdbfe']),
    headChrome: swatchThumbnail(['#e2e8f0', '#94a3b8', '#f8fafc']),
    headGold: swatchThumbnail(['#f59e0b', '#b45309', '#fde68a'])
  },
  tokenShape: {
    pawn: swatchThumbnail(['#f8fafc', '#1f2937', '#94a3b8']),
    knight: swatchThumbnail(['#f8fafc', '#1f2937', '#a855f7']),
    bishop: swatchThumbnail(['#f8fafc', '#1f2937', '#22c55e']),
    rook: swatchThumbnail(['#f8fafc', '#1f2937', '#f97316']),
    queen: swatchThumbnail(['#f8fafc', '#1f2937', '#ec4899']),
    king: swatchThumbnail(['#f8fafc', '#1f2937', '#f59e0b'])
  },
  captureWeapon: {
    fighter: swatchThumbnail(['#9ca3af', '#475569', '#cbd5e1']),
    helicopter: swatchThumbnail(['#84cc16', '#3f6212', '#bef264']),
    supportTruck: swatchThumbnail(['#f97316', '#7c2d12', '#fdba74']),
    drone: swatchThumbnail(['#60a5fa', '#1d4ed8', '#bfdbfe'])
  }
});

export const SNAKE_DEFAULT_UNLOCKS = Object.freeze({
  arenaTheme: ['nebulaAtrium'],
  boardPalette: ['desertMarble'],
  snakeSkin: ['emeraldScales'],
  diceTheme: ['imperialIvory'],
  tokenFinish: ['ceramicSheen'],
  tokenColor: ['amberGlow', 'mintVale', 'royalWave', 'roseMist'],
  tableFinish: [SNAKE_TABLE_FINISH_OPTIONS[0].id],
  headStyle: [SNAKE_PAWN_HEAD_OPTIONS[0].id],
  tokenShape: [SNAKE_TOKEN_SHAPE_OPTIONS[0].id],
  captureWeapon: [SNAKE_CAPTURE_WEAPON_OPTIONS[0].id],
  tables: [MURLAN_TABLE_THEMES[0].id],
  stools: [MURLAN_STOOL_THEMES[0].id],
  environmentHdri: [POOL_ROYALE_DEFAULT_HDRI_ID]
});

export const SNAKE_OPTION_LABELS = Object.freeze({
  arenaTheme: Object.freeze({
    nebulaAtrium: 'Nebula Atrium',
    crystalLagoon: 'Crystal Lagoon',
    royalEmber: 'Royal Ember'
  }),
  boardPalette: Object.freeze({
    desertMarble: 'Desert Marble',
    glacierGlass: 'Glacier Glass',
    jadeSanctum: 'Jade Sanctum'
  }),
  snakeSkin: Object.freeze({
    emeraldScales: 'Emerald Scales',
    midnightCobra: 'Midnight Cobra',
    emberSerpent: 'Ember Serpent'
  }),
  diceTheme: Object.freeze({
    imperialIvory: 'Imperial Ivory',
    onyxChrome: 'Onyx Chrome',
    auroraQuartz: 'Aurora Quartz'
  }),
  tokenFinish: Object.freeze({
    ceramicSheen: 'Ceramic Sheen',
    matteVelvet: 'Matte Velvet',
    holographicPulse: 'Holographic Pulse'
  }),
  tokenColor: mapLabels(SNAKE_TOKEN_COLOR_OPTIONS),
  headStyle: mapLabels(SNAKE_PAWN_HEAD_OPTIONS),
  tableFinish: mapLabels(SNAKE_TABLE_FINISH_OPTIONS),
  tokenShape: mapLabels(SNAKE_TOKEN_SHAPE_OPTIONS),
  captureWeapon: mapLabels(SNAKE_CAPTURE_WEAPON_OPTIONS),
  tables: mapLabels(MURLAN_TABLE_THEMES),
  stools: mapLabels(MURLAN_STOOL_THEMES),
  environmentHdri: Object.freeze(
    POOL_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
      acc[variant.id] = `${variant.name} HDRI`;
      return acc;
    }, {})
  )
});

export const SNAKE_STORE_ITEMS = [
  {
    id: 'capture-helicopter',
    type: 'captureWeapon',
    optionId: 'helicopter',
    name: 'Military Helicopter',
    price: 420,
    description: 'Capture eliminations use a helicopter flypath and strike animation.',
    thumbnail: SNAKE_THEME_THUMBNAILS.captureWeapon.helicopter
  },
  {
    id: 'capture-supportTruck',
    type: 'captureWeapon',
    optionId: 'supportTruck',
    name: 'Support Truck',
    price: 390,
    description: 'Capture eliminations use an armored truck flypath animation.',
    thumbnail: SNAKE_THEME_THUMBNAILS.captureWeapon.supportTruck
  },
  {
    id: 'capture-drone',
    type: 'captureWeapon',
    optionId: 'drone',
    name: 'Combat Drone',
    price: 360,
    description: 'Capture eliminations use a drone strike flypath.',
    thumbnail: SNAKE_THEME_THUMBNAILS.captureWeapon.drone
  },
  {
    id: 'arena-crystalLagoon',
    type: 'arenaTheme',
    optionId: 'crystalLagoon',
    name: 'Crystal Lagoon Arena',
    price: 680,
    description: 'Tropical teal lighting with lagoon accents and bright rim lights.',
    thumbnail: SNAKE_THEME_THUMBNAILS.arenaTheme.crystalLagoon
  },
  {
    id: 'arena-royalEmber',
    type: 'arenaTheme',
    optionId: 'royalEmber',
    name: 'Royal Ember Arena',
    price: 720,
    description: 'Amber floor grid with ember glow and royal purple carpet trim.',
    thumbnail: SNAKE_THEME_THUMBNAILS.arenaTheme.royalEmber
  },
  {
    id: 'board-glacierGlass',
    type: 'boardPalette',
    optionId: 'glacierGlass',
    name: 'Glacier Glass Board',
    price: 540,
    description: 'Icy glass surface with electric blue highlights and deep navy sides.',
    thumbnail: SNAKE_THEME_THUMBNAILS.boardPalette.glacierGlass
  },
  {
    id: 'board-jadeSanctum',
    type: 'boardPalette',
    optionId: 'jadeSanctum',
    name: 'Jade Sanctum Board',
    price: 560,
    description: 'Jade marble tones with golden ladders and warm ladder highlights.',
    thumbnail: SNAKE_THEME_THUMBNAILS.boardPalette.jadeSanctum
  },
  {
    id: 'skin-midnightCobra',
    type: 'snakeSkin',
    optionId: 'midnightCobra',
    name: 'Midnight Cobra Skin',
    price: 490,
    description: 'Midnight blue scales with violet diamonds and cool edge strokes.',
    thumbnail: SNAKE_THEME_THUMBNAILS.snakeSkin.midnightCobra
  },
  {
    id: 'skin-emberSerpent',
    type: 'snakeSkin',
    optionId: 'emberSerpent',
    name: 'Ember Serpent Skin',
    price: 520,
    description: 'Ember-toned scales with molten orange diamonds and glowing strokes.',
    thumbnail: SNAKE_THEME_THUMBNAILS.snakeSkin.emberSerpent
  },
  {
    id: 'dice-onyxChrome',
    type: 'diceTheme',
    optionId: 'onyxChrome',
    name: 'Onyx Chrome Dice',
    price: 450,
    description: 'Dark chrome dice with bright rim piping and crisp white pips.',
    thumbnail: SNAKE_THEME_THUMBNAILS.diceTheme.onyxChrome
  },
  {
    id: 'dice-auroraQuartz',
    type: 'diceTheme',
    optionId: 'auroraQuartz',
    name: 'Aurora Quartz Dice',
    price: 470,
    description: 'Iridescent quartz finish with neon cyan pips and pink rims.',
    thumbnail: SNAKE_THEME_THUMBNAILS.diceTheme.auroraQuartz
  },
  {
    id: 'token-matteVelvet',
    type: 'tokenFinish',
    optionId: 'matteVelvet',
    name: 'Matte Velvet Tokens',
    price: 430,
    description: 'Soft velvet finish with muted sheen and gentle accent glow.',
    thumbnail: SNAKE_THEME_THUMBNAILS.tokenFinish.matteVelvet
  },
  {
    id: 'token-holographicPulse',
    type: 'tokenFinish',
    optionId: 'holographicPulse',
    name: 'Holographic Pulse Tokens',
    price: 520,
    description: 'Holographic core with shimmering pulse highlights for each token.',
    thumbnail: SNAKE_THEME_THUMBNAILS.tokenFinish.holographicPulse
  },
  {
    id: 'snake-head-ruby',
    type: 'headStyle',
    optionId: 'headRuby',
    name: 'Ruby Pawn Heads',
    price: 310,
    description: 'Unlocks an additional pawn head glass preset.',
    thumbnail: SNAKE_THEME_THUMBNAILS.headStyle.headRuby
  },
  {
    id: 'snake-head-sapphire',
    type: 'headStyle',
    optionId: 'headSapphire',
    name: 'Sapphire Pawn Heads',
    price: 335,
    description: 'Unlocks an additional pawn head glass preset.',
    thumbnail: SNAKE_THEME_THUMBNAILS.headStyle.headSapphire
  },
  {
    id: 'snake-head-chrome',
    type: 'headStyle',
    optionId: 'headChrome',
    name: 'Chrome Pawn Heads',
    price: 360,
    description: 'Unlocks an additional pawn head glass preset.',
    thumbnail: SNAKE_THEME_THUMBNAILS.headStyle.headChrome
  },
  {
    id: 'snake-head-gold',
    type: 'headStyle',
    optionId: 'headGold',
    name: 'Gold Pawn Heads',
    price: 385,
    description: 'Unlocks an additional pawn head glass preset.',
    thumbnail: SNAKE_THEME_THUMBNAILS.headStyle.headGold
  },
  ...SNAKE_TOKEN_COLOR_OPTIONS.map((option, idx) => ({
    id: `snake-token-color-${option.id}`,
    type: 'tokenColor',
    optionId: option.id,
    name: `${option.label} Tokens`,
    price: 420 + idx * 35,
    description: `Chess Battle Royal ${option.label.toLowerCase()} palette for snake tokens.`,
    swatches: [option.color, '#0f172a'],
    thumbnail: swatchThumbnail([option.color, '#0f172a', '#f8fafc'])
  })),
  ...SNAKE_TABLE_FINISH_OPTIONS.map((finish, idx) => ({
    id: `finish-${finish.id}`,
    type: 'tableFinish',
    optionId: finish.id,
    name: `${finish.label} Finish`,
    price: 980 + idx * 15,
    description: `${finish.label} finish imported from Pool Royale.`,
    thumbnail: SNAKE_TABLE_FINISH_THUMBNAILS[finish.id]
  })),
  ...SNAKE_TOKEN_SHAPE_OPTIONS.map((option, idx) => ({
    id: `snake-token-${option.id}`,
    type: 'tokenShape',
    optionId: option.id,
    name: option.label,
    price: 480 + idx * 35,
    description: `Chess Battle Royal ${option.label.toLowerCase()} piece token.`,
    thumbnail: SNAKE_THEME_THUMBNAILS.tokenShape[option.id]
  }))
].concat(
  MURLAN_TABLE_THEMES.filter((theme, idx) => idx > 0).map((theme, idx) => ({
    id: `snake-table-${theme.id}`,
    type: 'tables',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 980 + idx * 40,
    description: theme.description || `${theme.label} table with preserved Poly Haven materials.`,
    thumbnail: theme.thumbnail
  })),
  MURLAN_STOOL_THEMES.filter((theme, idx) => idx > 0).map((theme, idx) => ({
    id: `snake-stool-${theme.id}`,
    type: 'stools',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 300 + idx * 20,
    description: theme.description || `Premium ${theme.label} seating with original finish.`,
    thumbnail: theme.thumbnail
  })),
  POOL_ROYALE_HDRI_VARIANTS.map((variant, idx) => ({
    id: `snake-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price ?? 1400 + idx * 25,
    description: variant.description || 'Pool Royale HDRI environment tuned for Snake & Ladder.',
    swatches: variant.swatches,
    thumbnail: variant.thumbnail,
    previewShape: 'table'
  }))
);

export const SNAKE_DEFAULT_LOADOUT = [
  { type: 'arenaTheme', optionId: 'nebulaAtrium', label: 'Nebula Atrium Arena' },
  { type: 'boardPalette', optionId: 'desertMarble', label: 'Desert Marble Board' },
  { type: 'snakeSkin', optionId: 'emeraldScales', label: 'Emerald Scales Skin' },
  { type: 'diceTheme', optionId: 'imperialIvory', label: 'Imperial Ivory Dice' },
  { type: 'tokenFinish', optionId: 'ceramicSheen', label: 'Ceramic Sheen Tokens' },
  { type: 'tokenColor', optionId: 'amberGlow', label: 'Amber Glow Tokens' },
  { type: 'headStyle', optionId: 'current', label: 'Current Pawn Heads' },
  {
    type: 'tableFinish',
    optionId: SNAKE_TABLE_FINISH_OPTIONS[0].id,
    label: SNAKE_TABLE_FINISH_OPTIONS[0].label
  },
  {
    type: 'tokenShape',
    optionId: SNAKE_TOKEN_SHAPE_OPTIONS[0].id,
    label: SNAKE_TOKEN_SHAPE_OPTIONS[0].label
  },
  {
    type: 'captureWeapon',
    optionId: SNAKE_CAPTURE_WEAPON_OPTIONS[0].id,
    label: SNAKE_CAPTURE_WEAPON_OPTIONS[0].label
  },
  { type: 'tables', optionId: MURLAN_TABLE_THEMES[0].id, label: MURLAN_TABLE_THEMES[0].label },
  { type: 'stools', optionId: MURLAN_STOOL_THEMES[0].id, label: MURLAN_STOOL_THEMES[0].label },
  {
    type: 'environmentHdri',
    optionId: POOL_ROYALE_DEFAULT_HDRI_ID,
    label: `${POOL_ROYALE_HDRI_VARIANTS[0].name} HDRI`
  }
];
