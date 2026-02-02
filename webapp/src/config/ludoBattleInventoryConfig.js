import {
  TOKEN_PALETTE_OPTIONS,
  TOKEN_PIECE_OPTIONS,
  TOKEN_STYLE_OPTIONS
} from './ludoBattleOptions.js';
import { POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';
import { MURLAN_TABLE_FINISHES } from './murlanTableFinishes.js';
import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';
import { CHESS_BATTLE_OPTION_LABELS, CHESS_BATTLE_STORE_ITEMS } from './chessBattleInventoryConfig.js';
import { swatchThumbnail } from './storeThumbnails.js';

export const LUDO_BATTLE_DEFAULT_UNLOCKS = Object.freeze({
  tables: [MURLAN_TABLE_THEMES[0]?.id],
  tableFinish: [MURLAN_TABLE_FINISHES[0]?.id],
  stools: [MURLAN_STOOL_THEMES[0]?.id],
  environmentHdri: POOL_ROYALE_HDRI_VARIANTS.map((variant) => variant.id),
  tokenPalette: [TOKEN_PALETTE_OPTIONS[0]?.id],
  tokenStyle: [TOKEN_STYLE_OPTIONS[0]?.id],
  tokenPiece: [TOKEN_PIECE_OPTIONS[0]?.id]
});

const reduceLabels = (options) =>
  options.reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {});

export const LUDO_BATTLE_OPTION_LABELS = Object.freeze({
  tables: Object.freeze(reduceLabels(MURLAN_TABLE_THEMES)),
  tableFinish: Object.freeze(reduceLabels(MURLAN_TABLE_FINISHES)),
  stools: Object.freeze(reduceLabels(MURLAN_STOOL_THEMES)),
  environmentHdri: Object.freeze(
    reduceLabels(
      POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
        id: variant.id,
        label: `${variant.name} HDRI`
      }))
    )
  ),
  tokenPalette: Object.freeze(reduceLabels(TOKEN_PALETTE_OPTIONS)),
  tokenStyle: Object.freeze(reduceLabels(TOKEN_STYLE_OPTIONS)),
  tokenPiece: Object.freeze(reduceLabels(TOKEN_PIECE_OPTIONS)),
  sideColor: Object.freeze(CHESS_BATTLE_OPTION_LABELS.sideColor),
  headStyle: Object.freeze(CHESS_BATTLE_OPTION_LABELS.headStyle)
});

export const LUDO_BATTLE_STORE_ITEMS = [
  ...MURLAN_TABLE_FINISHES.map((finish, idx) => ({
    id: `ludo-table-finish-${finish.id}`,
    type: 'tableFinish',
    optionId: finish.id,
    name: finish.label,
    price: finish.price ?? 980 + idx * 40,
    description: finish.description,
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'table'
  })),
  ...MURLAN_TABLE_THEMES.filter((theme, idx) => idx > 0).map((theme, idx) => ({
    id: `ludo-table-${theme.id}`,
    type: 'tables',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 980 + idx * 40,
    description: theme.description || `${theme.label} table with preserved Poly Haven materials.`,
    thumbnail: theme.thumbnail
  })),
  ...MURLAN_STOOL_THEMES.filter((theme, idx) => idx > 0).map((theme, idx) => ({
    id: `ludo-stool-${theme.id}`,
    type: 'stools',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 300 + idx * 20,
    description: theme.description || `Premium ${theme.label} seating with original finish.`,
    thumbnail: theme.thumbnail
  })),
  ...POOL_ROYALE_HDRI_VARIANTS.map((variant, idx) => ({
    id: `ludo-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price ?? 1400 + idx * 25,
    description: variant.description || 'Pool Royale HDRI environment tuned for wide-table arenas.',
    swatches: variant.swatches,
    thumbnail: variant.thumbnail,
    previewShape: 'table'
  })),
  ...TOKEN_PALETTE_OPTIONS.slice(1).map((option, idx) => ({
    id: `ludo-palette-${option.id}`,
    type: 'tokenPalette',
    optionId: option.id,
    name: `${option.label} Palette`,
    price: 260 + idx * 20,
    description: 'Alternate pawn color palette for every side.',
    thumbnail: swatchThumbnail(option.swatches.map((value) => `#${value.toString(16).padStart(6, '0')}`))
  })),
  ...TOKEN_STYLE_OPTIONS.slice(1).map((option) => ({
    id: `ludo-style-${option.id}`,
    type: 'tokenStyle',
    optionId: option.id,
    name: option.label,
    price: 450,
    description: 'Swap the token mesh set for a new silhouette.',
    thumbnail: swatchThumbnail(['#f8fafc', '#1f2937', '#94a3b8'])
  })),
  ...TOKEN_PIECE_OPTIONS.slice(1).map((option, idx) => ({
    id: `ludo-piece-${option.id}`,
    type: 'tokenPiece',
    optionId: option.id,
    name: option.label,
    price: 300 + idx * 20,
    description: 'Unlock an alternate piece identity for your pawns.',
    thumbnail: swatchThumbnail(['#f8fafc', '#0f172a', '#fbbf24'])
  })),
  ...CHESS_BATTLE_STORE_ITEMS.filter((item) => ['sideColor', 'headStyle'].includes(item.type))
];

export const LUDO_BATTLE_DEFAULT_LOADOUT = [
  { type: 'tables', optionId: MURLAN_TABLE_THEMES[0]?.id, label: MURLAN_TABLE_THEMES[0]?.label },
  {
    type: 'tableFinish',
    optionId: MURLAN_TABLE_FINISHES[0]?.id,
    label: MURLAN_TABLE_FINISHES[0]?.label
  },
  { type: 'stools', optionId: MURLAN_STOOL_THEMES[0]?.id, label: MURLAN_STOOL_THEMES[0]?.label },
  {
    type: 'environmentHdri',
    optionId: POOL_ROYALE_DEFAULT_HDRI_ID,
    label: LUDO_BATTLE_OPTION_LABELS.environmentHdri[POOL_ROYALE_DEFAULT_HDRI_ID] || 'HDR Environment'
  },
  { type: 'tokenPalette', optionId: TOKEN_PALETTE_OPTIONS[0]?.id, label: `${TOKEN_PALETTE_OPTIONS[0]?.label} Palette` },
  { type: 'tokenStyle', optionId: TOKEN_STYLE_OPTIONS[0]?.id, label: TOKEN_STYLE_OPTIONS[0]?.label },
  { type: 'tokenPiece', optionId: TOKEN_PIECE_OPTIONS[0]?.id, label: TOKEN_PIECE_OPTIONS[0]?.label }
];
