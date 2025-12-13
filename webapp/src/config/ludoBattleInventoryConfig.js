import {
  CHAIR_COLOR_OPTIONS,
  HEAD_PRESET_OPTIONS,
  TOKEN_PALETTE_OPTIONS,
  TOKEN_PIECE_OPTIONS,
  TOKEN_STYLE_OPTIONS
} from './ludoBattleOptions.js';
import { TABLE_BASE_OPTIONS, TABLE_CLOTH_OPTIONS, TABLE_WOOD_OPTIONS } from '../utils/tableCustomizationOptions.js';
import { TABLE_SHAPE_OPTIONS } from '../utils/murlanTable.js';

const DEFAULT_TABLE_SHAPE_ID = TABLE_SHAPE_OPTIONS[0]?.id;

export const LUDO_BATTLE_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: [TABLE_WOOD_OPTIONS[0]?.id],
  tableCloth: [TABLE_CLOTH_OPTIONS[0]?.id],
  tableBase: [TABLE_BASE_OPTIONS[0]?.id],
  chairColor: [CHAIR_COLOR_OPTIONS[0]?.id],
  tableShape: [DEFAULT_TABLE_SHAPE_ID],
  tokenPalette: [TOKEN_PALETTE_OPTIONS[0]?.id],
  tokenStyle: [TOKEN_STYLE_OPTIONS[0]?.id],
  tokenPiece: [TOKEN_PIECE_OPTIONS[0]?.id],
  headStyle: [HEAD_PRESET_OPTIONS[0]?.id]
});

const reduceLabels = (options) =>
  options.reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {});

export const LUDO_BATTLE_OPTION_LABELS = Object.freeze({
  tableWood: Object.freeze(reduceLabels(TABLE_WOOD_OPTIONS)),
  tableCloth: Object.freeze(reduceLabels(TABLE_CLOTH_OPTIONS)),
  tableBase: Object.freeze(reduceLabels(TABLE_BASE_OPTIONS)),
  chairColor: Object.freeze(reduceLabels(CHAIR_COLOR_OPTIONS)),
  tableShape: Object.freeze(reduceLabels(TABLE_SHAPE_OPTIONS)),
  tokenPalette: Object.freeze(reduceLabels(TOKEN_PALETTE_OPTIONS)),
  tokenStyle: Object.freeze(reduceLabels(TOKEN_STYLE_OPTIONS)),
  tokenPiece: Object.freeze(reduceLabels(TOKEN_PIECE_OPTIONS)),
  headStyle: Object.freeze(reduceLabels(HEAD_PRESET_OPTIONS))
});

export const LUDO_BATTLE_STORE_ITEMS = [
  ...TABLE_WOOD_OPTIONS.slice(1).map((option, idx) => ({
    id: `ludo-wood-${option.id}`,
    type: 'tableWood',
    optionId: option.id,
    name: option.label,
    price: 620 + idx * 40,
    description: 'Alternate wood finish for the Ludo royale table.'
  })),
  ...TABLE_CLOTH_OPTIONS.slice(1).map((option, idx) => ({
    id: `ludo-cloth-${option.id}`,
    type: 'tableCloth',
    optionId: option.id,
    name: option.label,
    price: 360 + idx * 35,
    description: 'Premium felt hue to swap into the arena surface.'
  })),
  ...TABLE_BASE_OPTIONS.slice(1).map((option, idx) => ({
    id: `ludo-base-${option.id}`,
    type: 'tableBase',
    optionId: option.id,
    name: option.label,
    price: 460 + idx * 40,
    description: 'Pedestal and trim upgrade for the Ludo table.'
  })),
  ...CHAIR_COLOR_OPTIONS.slice(1).map((option, idx) => ({
    id: `ludo-chair-${option.id}`,
    type: 'chairColor',
    optionId: option.id,
    name: `${option.label} Chairs`,
    price: 320 + idx * 20,
    description: 'Unlock an alternate lounge chair upholstery color.'
  })),
  ...TABLE_SHAPE_OPTIONS.slice(1).map((option, idx) => ({
    id: `ludo-shape-${option.id}`,
    type: 'tableShape',
    optionId: option.id,
    name: option.label,
    price: 640 + idx * 80,
    description: 'Swap the arena outline for a new premium silhouette.'
  })),
  ...TOKEN_PALETTE_OPTIONS.slice(1).map((option, idx) => ({
    id: `ludo-palette-${option.id}`,
    type: 'tokenPalette',
    optionId: option.id,
    name: `${option.label} Palette`,
    price: 260 + idx * 20,
    description: 'Alternate pawn color palette for every side.'
  })),
  ...TOKEN_STYLE_OPTIONS.slice(1).map((option) => ({
    id: `ludo-style-${option.id}`,
    type: 'tokenStyle',
    optionId: option.id,
    name: option.label,
    price: 450,
    description: 'Swap the token mesh set for a new silhouette.'
  })),
  ...TOKEN_PIECE_OPTIONS.slice(1).map((option, idx) => ({
    id: `ludo-piece-${option.id}`,
    type: 'tokenPiece',
    optionId: option.id,
    name: option.label,
    price: 300 + idx * 20,
    description: 'Unlock an alternate piece identity for your pawns.'
  })),
  ...HEAD_PRESET_OPTIONS.slice(1).map((option, idx) => ({
    id: `ludo-head-${option.id}`,
    type: 'headStyle',
    optionId: option.id,
    name: `${option.label} Heads`,
    price: 310 + idx * 20,
    description: 'Unlock a new glass preset for the pawn and bishop heads.'
  }))
];

export const LUDO_BATTLE_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: TABLE_WOOD_OPTIONS[0]?.id, label: TABLE_WOOD_OPTIONS[0]?.label },
  { type: 'tableCloth', optionId: TABLE_CLOTH_OPTIONS[0]?.id, label: TABLE_CLOTH_OPTIONS[0]?.label },
  { type: 'tableBase', optionId: TABLE_BASE_OPTIONS[0]?.id, label: TABLE_BASE_OPTIONS[0]?.label },
  { type: 'chairColor', optionId: CHAIR_COLOR_OPTIONS[0]?.id, label: `${CHAIR_COLOR_OPTIONS[0]?.label} Chairs` },
  { type: 'tableShape', optionId: DEFAULT_TABLE_SHAPE_ID, label: LUDO_BATTLE_OPTION_LABELS.tableShape[DEFAULT_TABLE_SHAPE_ID] },
  { type: 'tokenPalette', optionId: TOKEN_PALETTE_OPTIONS[0]?.id, label: `${TOKEN_PALETTE_OPTIONS[0]?.label} Palette` },
  { type: 'tokenStyle', optionId: TOKEN_STYLE_OPTIONS[0]?.id, label: TOKEN_STYLE_OPTIONS[0]?.label },
  { type: 'tokenPiece', optionId: TOKEN_PIECE_OPTIONS[0]?.id, label: TOKEN_PIECE_OPTIONS[0]?.label },
  { type: 'headStyle', optionId: HEAD_PRESET_OPTIONS[0]?.id, label: `${HEAD_PRESET_OPTIONS[0]?.label} Heads` }
];
