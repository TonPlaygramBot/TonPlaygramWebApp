import { POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';
import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';

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

export const SNAKE_HEAD_STYLE_OPTIONS = Object.freeze([
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

export const SNAKE_DEFAULT_UNLOCKS = Object.freeze({
  arenaTheme: ['nebulaAtrium'],
  boardPalette: ['desertMarble'],
  snakeSkin: ['emeraldScales'],
  diceTheme: ['imperialIvory'],
  railTheme: ['platinumOak'],
  tokenFinish: ['ceramicSheen'],
  tokenColor: ['amberGlow', 'mintVale', 'royalWave', 'roseMist'],
  headStyle: ['current'],
  tableFinish: [SNAKE_TABLE_FINISH_OPTIONS[0].id],
  floorTexture: [SNAKE_FLOOR_TEXTURE_OPTIONS[0].id],
  wallTexture: [SNAKE_WALL_TEXTURE_OPTIONS[0].id],
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
  headStyle: mapLabels(SNAKE_HEAD_STYLE_OPTIONS),
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
    description: 'Tropical teal lighting with lagoon accents and bright rim lights.'
  },
  {
    id: 'arena-royalEmber',
    type: 'arenaTheme',
    optionId: 'royalEmber',
    name: 'Royal Ember Arena',
    price: 720,
    description: 'Amber floor grid with ember glow and royal purple carpet trim.'
  },
  {
    id: 'board-glacierGlass',
    type: 'boardPalette',
    optionId: 'glacierGlass',
    name: 'Glacier Glass Board',
    price: 540,
    description: 'Icy glass surface with electric blue highlights and deep navy sides.'
  },
  {
    id: 'board-jadeSanctum',
    type: 'boardPalette',
    optionId: 'jadeSanctum',
    name: 'Jade Sanctum Board',
    price: 560,
    description: 'Jade marble tones with golden ladders and warm ladder highlights.'
  },
  {
    id: 'skin-midnightCobra',
    type: 'snakeSkin',
    optionId: 'midnightCobra',
    name: 'Midnight Cobra Skin',
    price: 490,
    description: 'Midnight blue scales with violet diamonds and cool edge strokes.'
  },
  {
    id: 'skin-emberSerpent',
    type: 'snakeSkin',
    optionId: 'emberSerpent',
    name: 'Ember Serpent Skin',
    price: 520,
    description: 'Ember-toned scales with molten orange diamonds and glowing strokes.'
  },
  {
    id: 'dice-onyxChrome',
    type: 'diceTheme',
    optionId: 'onyxChrome',
    name: 'Onyx Chrome Dice',
    price: 450,
    description: 'Dark chrome dice with bright rim piping and crisp white pips.'
  },
  {
    id: 'dice-auroraQuartz',
    type: 'diceTheme',
    optionId: 'auroraQuartz',
    name: 'Aurora Quartz Dice',
    price: 470,
    description: 'Iridescent quartz finish with neon cyan pips and pink rims.'
  },
  {
    id: 'rail-obsidianSteel',
    type: 'railTheme',
    optionId: 'obsidianSteel',
    name: 'Obsidian Steel Rails',
    price: 620,
    description: 'Graphite rails with steel nets and cool blue ladder hardware.'
  },
  {
    id: 'rail-emberBrass',
    type: 'railTheme',
    optionId: 'emberBrass',
    name: 'Ember Brass Rails',
    price: 640,
    description: 'Brass and ember rails with warm ladder rungs and vivid nets.'
  },
  {
    id: 'token-matteVelvet',
    type: 'tokenFinish',
    optionId: 'matteVelvet',
    name: 'Matte Velvet Tokens',
    price: 430,
    description: 'Soft velvet finish with muted sheen and gentle accent glow.'
  },
  {
    id: 'token-holographicPulse',
    type: 'tokenFinish',
    optionId: 'holographicPulse',
    name: 'Holographic Pulse Tokens',
    price: 520,
    description: 'Holographic core with shimmering pulse highlights for each token.'
  },
  ...SNAKE_TOKEN_COLOR_OPTIONS.map((option, idx) => ({
    id: `snake-token-color-${option.id}`,
    type: 'tokenColor',
    optionId: option.id,
    name: `${option.label} Tokens`,
    price: 420 + idx * 35,
    description: `Chess Battle Royal ${option.label.toLowerCase()} palette for snake tokens.`,
    swatches: [option.color, '#0f172a']
  })),
  ...SNAKE_TABLE_FINISH_OPTIONS.map((finish, idx) => ({
    id: `finish-${finish.id}`,
    type: 'tableFinish',
    optionId: finish.id,
    name: `${finish.label} Finish`,
    price: 980 + idx * 15,
    description: `${finish.label} finish imported from Pool Royale.`
  })),
  ...SNAKE_FLOOR_TEXTURE_OPTIONS.map((option, idx) => ({
    id: `snake-floor-${option.id}`,
    type: 'floorTexture',
    optionId: option.id,
    name: option.label,
    price: 640 + idx * 18,
    description: `Poly Haven pavement texture: ${option.label}.`
  })),
  ...SNAKE_WALL_TEXTURE_OPTIONS.map((option, idx) => ({
    id: `snake-wall-${option.id}`,
    type: 'wallTexture',
    optionId: option.id,
    name: option.label,
    price: 620 + idx * 16,
    description: `Poly Haven wall texture: ${option.label}.`
  })),
  ...SNAKE_TOKEN_SHAPE_OPTIONS.map((option, idx) => ({
    id: `snake-token-${option.id}`,
    type: 'tokenShape',
    optionId: option.id,
    name: option.label,
    price: 480 + idx * 35,
    description: `Chess Battle Royal ${option.label.toLowerCase()} piece token.`
  })),
  ...SNAKE_HEAD_STYLE_OPTIONS.filter((option) => option.id !== 'current').map((option, idx) => ({
    id: `snake-head-${option.id}`,
    type: 'headStyle',
    optionId: option.id,
    name: `${option.label} Pawn Heads`,
    price: 310 + idx * 25,
    description: 'Unlocks an additional pawn head glass preset.'
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
