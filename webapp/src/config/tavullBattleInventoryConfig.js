import { MURLAN_STOOL_THEMES } from './murlanThemes.js';
import { CHESS_TABLE_FINISH_OPTIONS, CHESS_TABLE_OPTIONS } from './chessBattleInventoryConfig.js';
import { FOUR_IN_ROW_BOARD_FRAME_FINISH_OPTIONS } from './fourInRowInventoryConfig.js';
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS
} from './poolRoyaleInventoryConfig.js';
import { swatchThumbnail } from './storeThumbnails.js';

const DEFAULT_HDRI_ID =
  POOL_ROYALE_DEFAULT_HDRI_ID || POOL_ROYALE_HDRI_VARIANTS[0]?.id;

const BASE_CHAIR_OPTIONS = [
  {
    id: 'crimsonVelvet',
    label: 'Crimson Velvet',
    primary: '#8b1538',
    accent: '#5c0f26',
    highlight: '#d35a7a',
    legColor: '#1f1f1f'
  },
  {
    id: 'midnightNavy',
    label: 'Midnight Blue',
    primary: '#153a8b',
    accent: '#0c214f',
    highlight: '#4d74d8',
    legColor: '#10131c'
  },
  {
    id: 'emeraldWave',
    label: 'Emerald Wave',
    primary: '#0f6a2f',
    accent: '#063d1b',
    highlight: '#48b26a',
    legColor: '#142318'
  },
  {
    id: 'onyxShadow',
    label: 'Onyx Shadow',
    primary: '#202020',
    accent: '#101010',
    highlight: '#6f6f6f',
    legColor: '#080808'
  },
  {
    id: 'royalPlum',
    label: 'Royal Chestnut',
    primary: '#3f1f5b',
    accent: '#2c1340',
    highlight: '#7c4ae0',
    legColor: '#140a24'
  }
].map((item) => ({
  ...item,
  thumbnail: swatchThumbnail([item.primary, item.accent, item.highlight])
}));

const mapStoolThemeToChair = (theme) => ({
  ...theme,
  primary: theme.seatColor || theme.primary || '#7c3aed',
  accent: theme.accent || theme.highlight || theme.seatColor,
  legColor: theme.legColor || theme.baseColor || '#111827',
  preserveMaterials: theme.preserveMaterials ?? theme.source === 'polyhaven'
});

export const TAVULL_BATTLE_CHAIR_OPTIONS = Object.freeze([
  ...MURLAN_STOOL_THEMES.map(mapStoolThemeToChair),
  ...BASE_CHAIR_OPTIONS
]);

export const TAVULL_BATTLE_BOARD_FINISH_OPTIONS = Object.freeze([
  ...CHESS_TABLE_FINISH_OPTIONS
]);
export const TAVULL_BATTLE_FRAME_FINISH_OPTIONS = Object.freeze([
  ...FOUR_IN_ROW_BOARD_FRAME_FINISH_OPTIONS
]);

export const TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS = Object.freeze(
  [
    { id: 'amberGlow', label: 'Amber Glow', dark: '#f59e0b', light: '#fef3c7' },
    { id: 'mintVale', label: 'Mint Vale', dark: '#10b981', light: '#d1fae5' },
    { id: 'royalWave', label: 'Royal Wave', dark: '#3b82f6', light: '#dbeafe' },
    { id: 'roseMist', label: 'Rose Mist', dark: '#ef4444', light: '#fee2e2' },
    { id: 'amethyst', label: 'Amethyst', dark: '#8b5cf6', light: '#ede9fe' },
    {
      id: 'cinderBlaze',
      label: 'Cinder Blaze',
      dark: '#ff6b35',
      light: '#ffedd5'
    },
    {
      id: 'arcticDrift',
      label: 'Arctic Drift',
      dark: '#93c5fd',
      light: '#eff6ff'
    }
  ].map((option) => ({
    ...option,
    thumbnail: swatchThumbnail([option.dark, option.light])
  }))
);

export const TAVULL_BATTLE_DEFAULT_UNLOCKS = Object.freeze({
  chairColor: [TAVULL_BATTLE_CHAIR_OPTIONS[0]?.id],
  tables: [CHESS_TABLE_OPTIONS[0]?.id],
  tableFinish: [CHESS_TABLE_FINISH_OPTIONS[0]?.id],
  boardFinish: [TAVULL_BATTLE_BOARD_FINISH_OPTIONS[0]?.id],
  frameFinish: [TAVULL_BATTLE_FRAME_FINISH_OPTIONS[0]?.id],
  triangleColor: [TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS[0]?.id],
  environmentHdri: [DEFAULT_HDRI_ID]
});

const reduceLabels = (options, labelKey = 'label') =>
  Object.freeze(
    options.reduce(
      (acc, option) => ({ ...acc, [option.id]: option[labelKey] }),
      {}
    )
  );

export const TAVULL_BATTLE_OPTION_LABELS = Object.freeze({
  chairColor: reduceLabels(TAVULL_BATTLE_CHAIR_OPTIONS),
  tables: reduceLabels(CHESS_TABLE_OPTIONS),
  tableFinish: reduceLabels(CHESS_TABLE_FINISH_OPTIONS),
  boardFinish: reduceLabels(TAVULL_BATTLE_BOARD_FINISH_OPTIONS),
  frameFinish: reduceLabels(TAVULL_BATTLE_FRAME_FINISH_OPTIONS),
  triangleColor: reduceLabels(TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS),
  environmentHdri: Object.freeze(
    POOL_ROYALE_HDRI_VARIANTS.reduce(
      (acc, variant) => ({ ...acc, [variant.id]: `${variant.name} HDRI` }),
      {}
    )
  )
});

export const TAVULL_BATTLE_STORE_ITEMS = [
  ...CHESS_TABLE_FINISH_OPTIONS.map((finish, idx) => ({
    id: `tavull-table-finish-${finish.id}`,
    type: 'tableFinish',
    optionId: finish.id,
    name: finish.label,
    price: finish.price ?? 980 + idx * 40,
    description: finish.description,
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'table'
  })),
  ...CHESS_TABLE_OPTIONS.map((theme, idx) => ({
    id: `tavull-table-${theme.id}`,
    type: 'tables',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 980 + idx * 40,
    description:
      theme.description ||
      `${theme.label} table with preserved Poly Haven materials.`,
    thumbnail: theme.thumbnail,
    previewShape: 'table'
  })),
  ...TAVULL_BATTLE_CHAIR_OPTIONS.slice(1).map((option, idx) => ({
    id: `tavull-chair-${option.id}`,
    type: 'chairColor',
    optionId: option.id,
    name: option.label,
    price: option.price ?? 320 + idx * 20,
    description:
      option.description ||
      `${option.label} seating tuned for Backgammon Royal.`,
    thumbnail: option.thumbnail,
    previewShape: 'chair'
  })),
  ...TAVULL_BATTLE_BOARD_FINISH_OPTIONS.slice(1).map((finish, idx) => ({
    id: `tavull-board-finish-${finish.id}`,
    type: 'boardFinish',
    optionId: finish.id,
    name: `${finish.label} Board`,
    price: 520 + idx * 35,
    description:
      'Pool Royale table finish textures for the dice-rolling board lanes and center area.',
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'board'
  })),
  ...TAVULL_BATTLE_FRAME_FINISH_OPTIONS.slice(1).map((finish, idx) => ({
    id: `tavull-frame-finish-${finish.id}`,
    type: 'frameFinish',
    optionId: finish.id,
    name: `${finish.label} Frame`,
    price: 620 + idx * 35,
    description:
      '4 in a Row frame material pack applied to the Backgammon board frame.',
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'board'
  })),
  ...TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS.slice(1).map((option, idx) => ({
    id: `tavull-triangle-${option.id}`,
    type: 'triangleColor',
    optionId: option.id,
    name: `${option.label} Triangles`,
    price: 420 + idx * 30,
    description:
      'Pool cloth style triangles recolored to match Chess Battle Royal piece palettes.',
    swatches: [option.dark, option.light],
    thumbnail: option.thumbnail,
    previewShape: 'board'
  })),
  ...POOL_ROYALE_HDRI_VARIANTS.map((variant, idx) => ({
    id: `tavull-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price ?? 1400 + idx * 30,
    description: `Arena lighting profile based on ${variant.name}.`,
    thumbnail:
      variant.thumbnail ||
      swatchThumbnail(variant.swatches || ['#1f2937', '#0f172a']),
    previewShape: 'table'
  }))
];

export const TAVULL_BATTLE_DEFAULT_LOADOUT = TAVULL_BATTLE_DEFAULT_UNLOCKS;
