import { POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';
import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';

const mapLabels = (options) =>
  Object.freeze(
    options.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  );

export const SNAKE_DEFAULT_UNLOCKS = Object.freeze({
  arenaTheme: ['nebulaAtrium'],
  boardPalette: ['desertMarble'],
  snakeSkin: ['emeraldScales'],
  diceTheme: ['imperialIvory'],
  railTheme: ['platinumOak'],
  tokenFinish: ['ceramicSheen'],
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
  }
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
  { type: 'tables', optionId: MURLAN_TABLE_THEMES[0].id, label: MURLAN_TABLE_THEMES[0].label },
  { type: 'stools', optionId: MURLAN_STOOL_THEMES[0].id, label: MURLAN_STOOL_THEMES[0].label },
  {
    type: 'environmentHdri',
    optionId: POOL_ROYALE_DEFAULT_HDRI_ID,
    label: `${POOL_ROYALE_HDRI_VARIANTS[0].name} HDRI`
  }
];
