import { TABLE_BASE_OPTIONS, TABLE_CLOTH_OPTIONS, TABLE_WOOD_OPTIONS } from '../utils/tableCustomizationOptions.js';
import { TABLE_SHAPE_OPTIONS } from '../utils/murlanTable.js';
import { CARD_THEMES } from '../utils/cards3d.js';
import {
  TEXAS_CHAIR_COLOR_OPTIONS,
  TEXAS_DEFAULT_HDRI_ID,
  TEXAS_HDRI_OPTIONS,
  TEXAS_TABLE_THEME_OPTIONS
} from './texasHoldemOptions.js';

const reduceLabels = (items) =>
  items.reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {});

export const TEXAS_HOLDEM_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: [TABLE_WOOD_OPTIONS[0]?.id],
  tableCloth: [TABLE_CLOTH_OPTIONS[0]?.id],
  tableBase: [TABLE_BASE_OPTIONS[0]?.id],
  chairColor: [TEXAS_CHAIR_COLOR_OPTIONS[0]?.id],
  tableShape: [TABLE_SHAPE_OPTIONS[0]?.id],
  tableTheme: [TEXAS_TABLE_THEME_OPTIONS[0]?.id],
  environmentHdri: [TEXAS_DEFAULT_HDRI_ID],
  cards: [CARD_THEMES[0]?.id]
});

export const TEXAS_HOLDEM_OPTION_LABELS = Object.freeze({
  tableWood: Object.freeze(reduceLabels(TABLE_WOOD_OPTIONS)),
  tableCloth: Object.freeze(reduceLabels(TABLE_CLOTH_OPTIONS)),
  tableBase: Object.freeze(reduceLabels(TABLE_BASE_OPTIONS)),
  chairColor: Object.freeze(reduceLabels(TEXAS_CHAIR_COLOR_OPTIONS)),
  tableShape: Object.freeze(reduceLabels(TABLE_SHAPE_OPTIONS)),
  tableTheme: Object.freeze(reduceLabels(TEXAS_TABLE_THEME_OPTIONS)),
  environmentHdri: Object.freeze(
    reduceLabels(TEXAS_HDRI_OPTIONS.map((option) => ({ ...option, label: option.label || `${option.name} HDRI` })))
  ),
  cards: Object.freeze(reduceLabels(CARD_THEMES))
});

export const TEXAS_HOLDEM_STORE_ITEMS = [
  ...TABLE_WOOD_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-wood-${option.id}`,
    type: 'tableWood',
    optionId: option.id,
    name: option.label,
    price: 540 + idx * 40,
    description: "Unlock an alternate wood finish for your Hold'em arena table."
  })),
  ...TABLE_CLOTH_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-cloth-${option.id}`,
    type: 'tableCloth',
    optionId: option.id,
    name: option.label,
    price: 360 + idx * 35,
    description: "Swap in a premium felt tone for your poker table."
  })),
  ...TABLE_BASE_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-base-${option.id}`,
    type: 'tableBase',
    optionId: option.id,
    name: option.label,
    price: 420 + idx * 35,
    description: 'Upgrade the pedestal finish beneath your Hold\'em surface.'
  })),
  ...TEXAS_CHAIR_COLOR_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-chair-${option.id}`,
    type: 'chairColor',
    optionId: option.id,
    name: `${option.label} Chairs`,
    price: 340 + idx * 30,
    description: 'Unlock an additional lounge chair palette for the poker ring.'
  })),
  ...TABLE_SHAPE_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-shape-${option.id}`,
    type: 'tableShape',
    optionId: option.id,
    name: option.label,
    price: 680 + idx * 80,
    description: 'Change the poker table silhouette.'
  })),
  ...TEXAS_TABLE_THEME_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-table-${option.id}`,
    type: 'tableTheme',
    optionId: option.id,
    name: option.label,
    price: option.price ?? 980 + idx * 45,
    description: option.description || 'Apply the Murlan Royale table collection to Hold\'em.',
    thumbnail: option.thumbnail
  })),
  ...TEXAS_HDRI_OPTIONS.map((option, idx) => ({
    id: `texas-hdri-${option.id}`,
    type: 'environmentHdri',
    optionId: option.id,
    name: option.label || `${option.name} HDRI`,
    price: option.price ?? 1400 + idx * 35,
    description: option.description || 'HDRI environment from the Pool/Murlan Royale library.',
    swatches: option.swatches,
    previewShape: 'table'
  })),
  ...CARD_THEMES.slice(1).map((option, idx) => ({
    id: `texas-card-${option.id}`,
    type: 'cards',
    optionId: option.id,
    name: `${option.label} Cards`,
    price: 460 + idx * 35,
    description: 'Add a fresh premium deck style to the arena.'
  }))
];

export const TEXAS_HOLDEM_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: TABLE_WOOD_OPTIONS[0]?.id, label: TABLE_WOOD_OPTIONS[0]?.label },
  { type: 'tableCloth', optionId: TABLE_CLOTH_OPTIONS[0]?.id, label: TABLE_CLOTH_OPTIONS[0]?.label },
  { type: 'tableBase', optionId: TABLE_BASE_OPTIONS[0]?.id, label: TABLE_BASE_OPTIONS[0]?.label },
  { type: 'chairColor', optionId: TEXAS_CHAIR_COLOR_OPTIONS[0]?.id, label: `${TEXAS_CHAIR_COLOR_OPTIONS[0]?.label} Chairs` },
  { type: 'tableShape', optionId: TABLE_SHAPE_OPTIONS[0]?.id, label: TABLE_SHAPE_OPTIONS[0]?.label },
  { type: 'tableTheme', optionId: TEXAS_TABLE_THEME_OPTIONS[0]?.id, label: TEXAS_TABLE_THEME_OPTIONS[0]?.label },
  {
    type: 'environmentHdri',
    optionId: TEXAS_DEFAULT_HDRI_ID,
    label: TEXAS_HOLDEM_OPTION_LABELS.environmentHdri[TEXAS_DEFAULT_HDRI_ID] || 'HDR Environment'
  },
  { type: 'cards', optionId: CARD_THEMES[0]?.id, label: `${CARD_THEMES[0]?.label} Cards` }
];
