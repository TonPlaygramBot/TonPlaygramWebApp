import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';
import { MURLAN_TABLE_FINISHES } from './murlanTableFinishes.js';
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS
} from './poolRoyaleInventoryConfig.js';
import { swatchThumbnail } from './storeThumbnails.js';

const DEFAULT_HDRI_ID = POOL_ROYALE_DEFAULT_HDRI_ID || POOL_ROYALE_HDRI_VARIANTS[0]?.id;

const BASE_CHAIR_OPTIONS = [
  {
    id: 'crimsonVelvet',
    label: 'Crimson Velvet',
    primary: '#8b1538',
    accent: '#5c0f26',
    highlight: '#d35a7a',
    legColor: '#1f1f1f',
    thumbnail: swatchThumbnail(['#8b1538', '#5c0f26', '#d35a7a'])
  },
  {
    id: 'midnightNavy',
    label: 'Midnight Blue',
    primary: '#153a8b',
    accent: '#0c214f',
    highlight: '#4d74d8',
    legColor: '#10131c',
    thumbnail: swatchThumbnail(['#153a8b', '#0c214f', '#4d74d8'])
  },
  {
    id: 'emeraldWave',
    label: 'Emerald Wave',
    primary: '#0f6a2f',
    accent: '#063d1b',
    highlight: '#48b26a',
    legColor: '#142318',
    thumbnail: swatchThumbnail(['#0f6a2f', '#063d1b', '#48b26a'])
  },
  {
    id: 'onyxShadow',
    label: 'Onyx Shadow',
    primary: '#202020',
    accent: '#101010',
    highlight: '#6f6f6f',
    legColor: '#080808',
    thumbnail: swatchThumbnail(['#202020', '#101010', '#6f6f6f'])
  },
  {
    id: 'royalPlum',
    label: 'Royal Chestnut',
    primary: '#3f1f5b',
    accent: '#2c1340',
    highlight: '#7c4ae0',
    legColor: '#140a24',
    thumbnail: swatchThumbnail(['#3f1f5b', '#2c1340', '#7c4ae0'])
  }
];

const mapStoolThemeToChair = (theme) => ({
  ...theme,
  primary: theme.seatColor || theme.primary || '#7c3aed',
  accent: theme.accent || theme.highlight || theme.seatColor,
  legColor: theme.legColor || theme.baseColor || '#111827',
  preserveMaterials: theme.preserveMaterials ?? theme.source === 'polyhaven'
});

export const CHESS_CHAIR_OPTIONS = Object.freeze([
  ...BASE_CHAIR_OPTIONS,
  ...MURLAN_STOOL_THEMES.map(mapStoolThemeToChair)
]);

export const CHESS_TABLE_OPTIONS = Object.freeze([...MURLAN_TABLE_THEMES]);

export const CHESS_BATTLE_DEFAULT_UNLOCKS = Object.freeze({
  chairColor: [CHESS_CHAIR_OPTIONS[0]?.id],
  tables: [CHESS_TABLE_OPTIONS[0]?.id],
  tableFinish: [MURLAN_TABLE_FINISHES[0]?.id],
  sideColor: ['amberGlow', 'mintVale'],
  boardTheme: ['classic'],
  headStyle: ['current'],
  environmentHdri: [DEFAULT_HDRI_ID]
});

export const CHESS_BATTLE_OPTION_LABELS = Object.freeze({
  chairColor: Object.freeze(
    CHESS_CHAIR_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  tables: Object.freeze(
    CHESS_TABLE_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  tableFinish: Object.freeze(
    MURLAN_TABLE_FINISHES.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  sideColor: Object.freeze({
    marble: 'Marble',
    darkForest: 'Dark Forest',
    amberGlow: 'Amber Glow',
    mintVale: 'Mint Vale',
    royalWave: 'Royal Wave',
    roseMist: 'Rose Mist',
    amethyst: 'Amethyst',
    cinderBlaze: 'Cinder Blaze',
    arcticDrift: 'Arctic Drift'
  }),
  boardTheme: Object.freeze({
    classic: 'Classic',
    ivorySlate: 'Ivory/Slate',
    forest: 'Forest',
    sand: 'Sand/Brown',
    ocean: 'Ocean',
    violet: 'Violet',
    chrome: 'Chrome',
    nebulaGlass: 'Nebula Glass'
  }),
  headStyle: Object.freeze({
    current: 'Current',
    headRuby: 'Ruby',
    headSapphire: 'Sapphire',
    headChrome: 'Chrome',
    headGold: 'Gold'
  }),
  environmentHdri: Object.freeze(
    POOL_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
      acc[variant.id] = `${variant.name} HDRI`;
      return acc;
    }, {})
  )
});

export const CHESS_BATTLE_OPTION_THUMBNAILS = Object.freeze({
  sideColor: Object.freeze({
    marble: '/assets/game-art/chess-battle-royal/pieces/marble.svg',
    darkForest: '/assets/game-art/chess-battle-royal/pieces/darkForest.svg',
    amberGlow: '/assets/game-art/chess-battle-royal/pieces/amberGlow.svg',
    mintVale: '/assets/game-art/chess-battle-royal/pieces/mintVale.svg',
    royalWave: '/assets/game-art/chess-battle-royal/pieces/royalWave.svg',
    roseMist: '/assets/game-art/chess-battle-royal/pieces/roseMist.svg',
    amethyst: '/assets/game-art/chess-battle-royal/pieces/amethyst.svg',
    cinderBlaze: '/assets/game-art/chess-battle-royal/pieces/cinderBlaze.svg',
    arcticDrift: '/assets/game-art/chess-battle-royal/pieces/arcticDrift.svg'
  }),
  boardTheme: Object.freeze({
    classic: '/assets/game-art/chess-battle-royal/boards/classic.svg',
    ivorySlate: '/assets/game-art/chess-battle-royal/boards/ivorySlate.svg',
    forest: '/assets/game-art/chess-battle-royal/boards/forest.svg',
    sand: '/assets/game-art/chess-battle-royal/boards/sand.svg',
    ocean: '/assets/game-art/chess-battle-royal/boards/ocean.svg',
    violet: '/assets/game-art/chess-battle-royal/boards/violet.svg',
    chrome: '/assets/game-art/chess-battle-royal/boards/chrome.svg',
    nebulaGlass: '/assets/game-art/chess-battle-royal/boards/nebulaGlass.svg'
  }),
  headStyle: Object.freeze({
    current: '/assets/game-art/chess-battle-royal/heads/current.svg',
    headRuby: '/assets/game-art/chess-battle-royal/heads/headRuby.svg',
    headSapphire: '/assets/game-art/chess-battle-royal/heads/headSapphire.svg',
    headChrome: '/assets/game-art/chess-battle-royal/heads/headChrome.svg',
    headGold: '/assets/game-art/chess-battle-royal/heads/headGold.svg'
  })
});

export const CHESS_BATTLE_STORE_ITEMS = [
  ...MURLAN_TABLE_FINISHES.map((finish, idx) => ({
    id: `chess-table-finish-${finish.id}`,
    type: 'tableFinish',
    optionId: finish.id,
    name: finish.label,
    price: finish.price ?? 980 + idx * 40,
    description: finish.description,
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'table'
  })),
  ...CHESS_TABLE_OPTIONS.slice(1).map((theme, idx) => ({
    id: `chess-table-${theme.id}`,
    type: 'tables',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 980 + idx * 40,
    description: theme.description || `${theme.label} table with preserved Poly Haven materials.`,
    thumbnail: theme.thumbnail,
    previewShape: 'table'
  })),
  ...CHESS_CHAIR_OPTIONS.slice(1).map((option, idx) => ({
    id: `chess-chair-${option.id}`,
    type: 'chairColor',
    optionId: option.id,
    name: option.label,
    price: option.price ?? 320 + idx * 20,
    description:
      option.description ||
      `${option.label} seating tuned for Chess Battle Royal.`,
    thumbnail: option.thumbnail,
    previewShape: 'chair'
  })),
  {
    id: 'chess-side-marble',
    type: 'sideColor',
    optionId: 'marble',
    name: 'Marble Pieces',
    price: 1400,
    description: 'Premium marble-inspired pieces for either side.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.marble
  },
  {
    id: 'chess-side-forest',
    type: 'sideColor',
    optionId: 'darkForest',
    name: 'Dark Forest Pieces',
    price: 1300,
    description: 'Deep forest hue pieces with luxe accents.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.darkForest
  },
  {
    id: 'chess-side-royal',
    type: 'sideColor',
    optionId: 'royalWave',
    name: 'Royal Wave Pieces',
    price: 420,
    description: 'Royal blue quick-select palette.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.royalWave
  },
  {
    id: 'chess-side-rose',
    type: 'sideColor',
    optionId: 'roseMist',
    name: 'Rose Mist Pieces',
    price: 420,
    description: 'Rosy quick-select palette with soft glow.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.roseMist
  },
  {
    id: 'chess-side-amethyst',
    type: 'sideColor',
    optionId: 'amethyst',
    name: 'Amethyst Pieces',
    price: 460,
    description: 'Amethyst quick-select palette with sheen.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.amethyst
  },
  {
    id: 'chess-side-cinder',
    type: 'sideColor',
    optionId: 'cinderBlaze',
    name: 'Cinder Blaze Pieces',
    price: 480,
    description: 'Molten orange-on-charcoal palette for fiery showdowns.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.cinderBlaze
  },
  {
    id: 'chess-side-arctic',
    type: 'sideColor',
    optionId: 'arcticDrift',
    name: 'Arctic Drift Pieces',
    price: 520,
    description: 'Icy stone palette with frosted metallic hints.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.arcticDrift
  },
  {
    id: 'chess-board-ivorySlate',
    type: 'boardTheme',
    optionId: 'ivorySlate',
    name: 'Ivory/Slate Board',
    price: 380,
    description: 'Alternate board palette for fast swaps.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.ivorySlate
  },
  {
    id: 'chess-board-forest',
    type: 'boardTheme',
    optionId: 'forest',
    name: 'Forest Board',
    price: 410,
    description: 'Alternate board palette for fast swaps.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.forest
  },
  {
    id: 'chess-board-sand',
    type: 'boardTheme',
    optionId: 'sand',
    name: 'Sand/Brown Board',
    price: 440,
    description: 'Alternate board palette for fast swaps.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.sand
  },
  {
    id: 'chess-board-ocean',
    type: 'boardTheme',
    optionId: 'ocean',
    name: 'Ocean Board',
    price: 470,
    description: 'Alternate board palette for fast swaps.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.ocean
  },
  {
    id: 'chess-board-violet',
    type: 'boardTheme',
    optionId: 'violet',
    name: 'Violet Board',
    price: 500,
    description: 'Alternate board palette for fast swaps.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.violet
  },
  {
    id: 'chess-board-chrome',
    type: 'boardTheme',
    optionId: 'chrome',
    name: 'Chrome Board',
    price: 540,
    description: 'Alternate board palette for fast swaps.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.chrome
  },
  {
    id: 'chess-board-nebula',
    type: 'boardTheme',
    optionId: 'nebulaGlass',
    name: 'Nebula Glass Board',
    price: 580,
    description: 'Cosmic glass palette with deep-space contrasts.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.nebulaGlass
  },
  {
    id: 'chess-head-ruby',
    type: 'headStyle',
    optionId: 'headRuby',
    name: 'Ruby Pawn Heads',
    price: 310,
    description: 'Unlocks an additional pawn head glass preset.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.headStyle.headRuby
  },
  {
    id: 'chess-head-sapphire',
    type: 'headStyle',
    optionId: 'headSapphire',
    name: 'Sapphire Pawn Heads',
    price: 335,
    description: 'Unlocks an additional pawn head glass preset.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.headStyle.headSapphire
  },
  {
    id: 'chess-head-chrome',
    type: 'headStyle',
    optionId: 'headChrome',
    name: 'Chrome Pawn Heads',
    price: 360,
    description: 'Unlocks an additional pawn head glass preset.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.headStyle.headChrome
  },
  {
    id: 'chess-head-gold',
    type: 'headStyle',
    optionId: 'headGold',
    name: 'Gold Pawn Heads',
    price: 385,
    description: 'Unlocks an additional pawn head glass preset.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.headStyle.headGold
  },
  ...POOL_ROYALE_HDRI_VARIANTS.map((variant, idx) => ({
    id: `chess-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price ?? 1400 + idx * 30,
    description: 'Pool Royale HDRI environment, tuned for chess table promos.',
    thumbnail: variant.thumbnail
  }))
];

export const CHESS_BATTLE_DEFAULT_LOADOUT = [
  { type: 'tables', optionId: CHESS_TABLE_OPTIONS[0]?.id, label: CHESS_TABLE_OPTIONS[0]?.label },
  { type: 'chairColor', optionId: CHESS_CHAIR_OPTIONS[0]?.id, label: CHESS_CHAIR_OPTIONS[0]?.label },
  {
    type: 'tableFinish',
    optionId: MURLAN_TABLE_FINISHES[0]?.id,
    label: MURLAN_TABLE_FINISHES[0]?.label
  },
  { type: 'sideColor', optionId: 'amberGlow', label: 'Amber Glow Pieces' },
  { type: 'sideColor', optionId: 'mintVale', label: 'Mint Vale Pieces' },
  { type: 'boardTheme', optionId: 'classic', label: 'Classic Board' },
  { type: 'headStyle', optionId: 'current', label: 'Current Pawn Heads' },
  {
    type: 'environmentHdri',
    optionId: DEFAULT_HDRI_ID,
    label: CHESS_BATTLE_OPTION_LABELS.environmentHdri[DEFAULT_HDRI_ID] || 'HDR Environment'
  }
];
