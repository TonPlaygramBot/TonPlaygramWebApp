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

const SNAKE_FLOOR_TEXTURE_OPTIONS = Object.freeze([
  { id: 'paving_stones_02', label: 'Paving Stones 02' },
  { id: 'paving_stones_07', label: 'Paving Stones 07' },
  { id: 'paving_stones_08', label: 'Paving Stones 08' },
  { id: 'paving_stones_12', label: 'Paving Stones 12' },
  { id: 'cobblestone_floor_03', label: 'Cobblestone Floor 03' },
  { id: 'cobblestone_floor_05', label: 'Cobblestone Floor 05' },
  { id: 'concrete_pavers_01', label: 'Concrete Pavers 01' },
  { id: 'concrete_pavers_02', label: 'Concrete Pavers 02' },
  { id: 'stone_floor_05', label: 'Stone Floor 05' },
  { id: 'stone_floor_06', label: 'Stone Floor 06' }
]);

const SNAKE_WALL_TEXTURE_OPTIONS = Object.freeze([
  { id: 'brick_wall_02', label: 'Brick Wall 02' },
  { id: 'brick_wall_03', label: 'Brick Wall 03' },
  { id: 'castle_wall_01', label: 'Castle Wall 01' },
  { id: 'concrete_wall_002', label: 'Concrete Wall 002' },
  { id: 'concrete_wall_004', label: 'Concrete Wall 004' },
  { id: 'painted_wall_01', label: 'Painted Wall 01' },
  { id: 'plaster_wall_01', label: 'Plaster Wall 01' },
  { id: 'stone_wall_02', label: 'Stone Wall 02' },
  { id: 'stone_wall_03', label: 'Stone Wall 03' },
  { id: 'tiles_wall_01', label: 'Tiles Wall 01' }
]);

const SNAKE_TOKEN_SHAPE_OPTIONS = Object.freeze([
  { id: 'pawn', label: 'Pawn Token' },
  { id: 'knight', label: 'Knight Token' },
  { id: 'bishop', label: 'Bishop Token' },
  { id: 'rook', label: 'Rook Token' },
  { id: 'queen', label: 'Queen Token' },
  { id: 'king', label: 'King Token' }
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

const SNAKE_FLOOR_TEXTURE_THUMBNAILS = Object.freeze({
  paving_stones_02: swatchThumbnail(['#9ca3af', '#6b7280', '#e2e8f0']),
  paving_stones_07: swatchThumbnail(['#94a3b8', '#64748b', '#cbd5f5']),
  paving_stones_08: swatchThumbnail(['#a3a3a3', '#525252', '#e5e5e5']),
  paving_stones_12: swatchThumbnail(['#cbd5f5', '#94a3b8', '#e2e8f0']),
  cobblestone_floor_03: polyHavenThumb('cobblestone_floor_03'),
  cobblestone_floor_05: polyHavenThumb('cobblestone_floor_05'),
  concrete_pavers_01: swatchThumbnail(['#94a3b8', '#475569', '#e2e8f0']),
  concrete_pavers_02: polyHavenThumb('concrete_pavers_02'),
  stone_floor_05: swatchThumbnail(['#9ca3af', '#4b5563', '#e5e7eb']),
  stone_floor_06: swatchThumbnail(['#a8a29e', '#78716c', '#f5f5f4'])
});

const SNAKE_WALL_TEXTURE_THUMBNAILS = Object.freeze({
  brick_wall_02: polyHavenThumb('brick_wall_02'),
  brick_wall_03: swatchThumbnail(['#b91c1c', '#7f1d1d', '#fecaca']),
  castle_wall_01: swatchThumbnail(['#9ca3af', '#6b7280', '#e5e7eb']),
  concrete_wall_002: swatchThumbnail(['#94a3b8', '#475569', '#e2e8f0']),
  concrete_wall_004: polyHavenThumb('concrete_wall_004'),
  painted_wall_01: swatchThumbnail(['#e2e8f0', '#cbd5f5', '#f8fafc']),
  plaster_wall_01: swatchThumbnail(['#f5f5f4', '#d6d3d1', '#e7e5e4']),
  stone_wall_02: polyHavenThumb('stone_wall_02'),
  stone_wall_03: polyHavenThumb('stone_wall_03'),
  tiles_wall_01: swatchThumbnail(['#e5e7eb', '#94a3b8', '#f8fafc'])
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
  railTheme: {
    obsidianSteel: swatchThumbnail(['#1f2937', '#0f172a', '#93c5fd']),
    emberBrass: swatchThumbnail(['#f59e0b', '#92400e', '#fde68a'])
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
  }
});

export const SNAKE_DEFAULT_UNLOCKS = Object.freeze({
  arenaTheme: ['nebulaAtrium'],
  boardPalette: ['desertMarble'],
  snakeSkin: ['emeraldScales'],
  diceTheme: ['imperialIvory'],
  railTheme: ['platinumOak'],
  tokenFinish: ['ceramicSheen'],
  tokenColor: ['amberGlow', 'mintVale', 'royalWave', 'roseMist'],
  tableFinish: [SNAKE_TABLE_FINISH_OPTIONS[0].id],
  floorTexture: [SNAKE_FLOOR_TEXTURE_OPTIONS[0].id],
  wallTexture: [SNAKE_WALL_TEXTURE_OPTIONS[0].id],
  headStyle: [SNAKE_PAWN_HEAD_OPTIONS[0].id],
  tokenShape: [SNAKE_TOKEN_SHAPE_OPTIONS[0].id],
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
  railTheme: Object.freeze({
    platinumOak: 'Platinum & Oak',
    obsidianSteel: 'Obsidian Steel',
    emberBrass: 'Ember Brass'
  }),
  tokenFinish: Object.freeze({
    ceramicSheen: 'Ceramic Sheen',
    matteVelvet: 'Matte Velvet',
    holographicPulse: 'Holographic Pulse'
  }),
  tokenColor: mapLabels(SNAKE_TOKEN_COLOR_OPTIONS),
  headStyle: mapLabels(SNAKE_PAWN_HEAD_OPTIONS),
  tableFinish: mapLabels(SNAKE_TABLE_FINISH_OPTIONS),
  floorTexture: mapLabels(SNAKE_FLOOR_TEXTURE_OPTIONS),
  wallTexture: mapLabels(SNAKE_WALL_TEXTURE_OPTIONS),
  tokenShape: mapLabels(SNAKE_TOKEN_SHAPE_OPTIONS),
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
    id: 'rail-obsidianSteel',
    type: 'railTheme',
    optionId: 'obsidianSteel',
    name: 'Obsidian Steel Rails',
    price: 620,
    description: 'Graphite rails with steel nets and cool blue ladder hardware.',
    thumbnail: SNAKE_THEME_THUMBNAILS.railTheme.obsidianSteel
  },
  {
    id: 'rail-emberBrass',
    type: 'railTheme',
    optionId: 'emberBrass',
    name: 'Ember Brass Rails',
    price: 640,
    description: 'Brass and ember rails with warm ladder rungs and vivid nets.',
    thumbnail: SNAKE_THEME_THUMBNAILS.railTheme.emberBrass
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
  ...SNAKE_FLOOR_TEXTURE_OPTIONS.map((option, idx) => ({
    id: `snake-floor-${option.id}`,
    type: 'floorTexture',
    optionId: option.id,
    name: option.label,
    price: 640 + idx * 18,
    description: `Poly Haven pavement texture: ${option.label}.`,
    thumbnail: SNAKE_FLOOR_TEXTURE_THUMBNAILS[option.id]
  })),
  ...SNAKE_WALL_TEXTURE_OPTIONS.map((option, idx) => ({
    id: `snake-wall-${option.id}`,
    type: 'wallTexture',
    optionId: option.id,
    name: option.label,
    price: 620 + idx * 16,
    description: `Poly Haven wall texture: ${option.label}.`,
    thumbnail: SNAKE_WALL_TEXTURE_THUMBNAILS[option.id]
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
  { type: 'railTheme', optionId: 'platinumOak', label: 'Platinum & Oak Rails' },
  { type: 'tokenFinish', optionId: 'ceramicSheen', label: 'Ceramic Sheen Tokens' },
  { type: 'tokenColor', optionId: 'amberGlow', label: 'Amber Glow Tokens' },
  { type: 'headStyle', optionId: 'current', label: 'Current Pawn Heads' },
  {
    type: 'tableFinish',
    optionId: SNAKE_TABLE_FINISH_OPTIONS[0].id,
    label: SNAKE_TABLE_FINISH_OPTIONS[0].label
  },
  {
    type: 'floorTexture',
    optionId: SNAKE_FLOOR_TEXTURE_OPTIONS[0].id,
    label: SNAKE_FLOOR_TEXTURE_OPTIONS[0].label
  },
  {
    type: 'wallTexture',
    optionId: SNAKE_WALL_TEXTURE_OPTIONS[0].id,
    label: SNAKE_WALL_TEXTURE_OPTIONS[0].label
  },
  {
    type: 'tokenShape',
    optionId: SNAKE_TOKEN_SHAPE_OPTIONS[0].id,
    label: SNAKE_TOKEN_SHAPE_OPTIONS[0].label
  },
  { type: 'tables', optionId: MURLAN_TABLE_THEMES[0].id, label: MURLAN_TABLE_THEMES[0].label },
  { type: 'stools', optionId: MURLAN_STOOL_THEMES[0].id, label: MURLAN_STOOL_THEMES[0].label },
  {
    type: 'environmentHdri',
    optionId: POOL_ROYALE_DEFAULT_HDRI_ID,
    label: `${POOL_ROYALE_HDRI_VARIANTS[0].name} HDRI`
  }
];
