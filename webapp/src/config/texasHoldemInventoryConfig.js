import { TABLE_BASE_OPTIONS, TABLE_CLOTH_OPTIONS, TABLE_WOOD_OPTIONS } from '../utils/tableCustomizationOptions.js';
import { TABLE_SHAPE_OPTIONS } from '../utils/murlanTable.js';
import { CARD_THEMES } from '../utils/cards3d.js';
import {
  BATTLE_ROYALE_SHARED_CHAIR_THEME_OPTIONS,
  BATTLE_ROYALE_SHARED_HDRI_VARIANTS,
  BATTLE_ROYALE_SHARED_TABLE_FINISH_OPTIONS,
  BATTLE_ROYALE_SHARED_TABLE_THEME_OPTIONS
} from './battleRoyaleSharedInventory.js';
import { polyHavenThumb } from './storeThumbnails.js';

const reduceLabels = (items) =>
  items.reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {});

export const TEXAS_HDRI_OPTIONS = BATTLE_ROYALE_SHARED_HDRI_VARIANTS.map((variant) => ({
  ...variant,
  label: `${variant.name} HDRI`
}));

export const TEXAS_DEFAULT_HDRI_ID = 'dancingHall';

export const TEXAS_TABLE_FINISH_OPTIONS = Object.freeze(
  BATTLE_ROYALE_SHARED_TABLE_FINISH_OPTIONS.map((option) => {
    const WOOD_MAPPING_BY_FINISH = {
      peelingPaintWeathered: { presetId: 'oak', grainId: 'wood_peeling_paint_weathered' },
      oakVeneer01: { presetId: 'oak', grainId: 'oak_veneer_01' },
      woodTable001: { presetId: 'walnut', grainId: 'wood_table_001' },
      darkWood: { presetId: 'smokedOak', grainId: 'dark_wood' },
      rosewoodVeneer01: { presetId: 'cherry', grainId: 'rosewood_veneer_01' }
    };
    const swatchesById = {
      peelingPaintWeathered: ['#a89f95', '#b8b3aa'],
      oakVeneer01: ['#b9854e', '#c89a64'],
      woodTable001: ['#8f6243', '#a4724f'],
      darkWood: ['#2f241f', '#3d2f2a'],
      rosewoodVeneer01: ['#5b2f26', '#6f3a2f']
    };
    const wood = WOOD_MAPPING_BY_FINISH[option.id];
    return {
      ...option,
      swatches: swatchesById[option.id] || [],
      thumbnail: polyHavenThumb(wood?.grainId || option.id),
      woodOption: wood
        ? {
            id: option.id,
            label: option.label,
            presetId: wood.presetId,
            grainId: wood.grainId
          }
        : null
    };
  })
);

export const TEXAS_CHAIR_THEME_OPTIONS = BATTLE_ROYALE_SHARED_CHAIR_THEME_OPTIONS;
export const TEXAS_TABLE_THEME_OPTIONS = BATTLE_ROYALE_SHARED_TABLE_THEME_OPTIONS;

const DEFAULT_HDRI_INDEX = Math.max(0, TEXAS_HDRI_OPTIONS.findIndex((variant) => variant.id === TEXAS_DEFAULT_HDRI_ID));

export const TEXAS_HOLDEM_DEFAULT_UNLOCKS = Object.freeze({
  tableFinish: [TEXAS_TABLE_FINISH_OPTIONS[0]?.id],
  tableWood: [TABLE_WOOD_OPTIONS[0]?.id],
  tableCloth: [TABLE_CLOTH_OPTIONS[0]?.id],
  tableBase: [TABLE_BASE_OPTIONS[0]?.id],
  chairTheme: [TEXAS_CHAIR_THEME_OPTIONS[0]?.id],
  tableTheme: [TEXAS_TABLE_THEME_OPTIONS[0]?.id],
  tableShape: [TABLE_SHAPE_OPTIONS[0]?.id],
  cards: [CARD_THEMES[0]?.id],
  environmentHdri: [TEXAS_DEFAULT_HDRI_ID]
});

export const TEXAS_HOLDEM_OPTION_LABELS = Object.freeze({
  tableFinish: Object.freeze(reduceLabels(TEXAS_TABLE_FINISH_OPTIONS)),
  tableWood: Object.freeze(reduceLabels(TABLE_WOOD_OPTIONS)),
  tableCloth: Object.freeze(reduceLabels(TABLE_CLOTH_OPTIONS)),
  tableBase: Object.freeze(reduceLabels(TABLE_BASE_OPTIONS)),
  chairTheme: Object.freeze(reduceLabels(TEXAS_CHAIR_THEME_OPTIONS)),
  tableTheme: Object.freeze(reduceLabels(TEXAS_TABLE_THEME_OPTIONS)),
  tableShape: Object.freeze(reduceLabels(TABLE_SHAPE_OPTIONS)),
  cards: Object.freeze(reduceLabels(CARD_THEMES)),
  environmentHdri: Object.freeze(
    TEXAS_HDRI_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  )
});

export const TEXAS_HOLDEM_STORE_ITEMS = [
  ...TEXAS_TABLE_FINISH_OPTIONS.map((option) => ({
    id: `texas-finish-${option.id}`,
    type: 'tableFinish',
    optionId: option.id,
    name: `${option.label} Finish`,
    price: option.price,
    description: option.description,
    swatches: option.swatches,
    thumbnail: option.thumbnail
  })),
  ...TABLE_WOOD_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-wood-${option.id}`,
    type: 'tableWood',
    optionId: option.id,
    name: option.label,
    price: 540 + idx * 40,
    description: "Unlock an alternate wood finish for your Hold'em arena table.",
    thumbnail: option.thumbnail
  })),
  ...TABLE_CLOTH_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-cloth-${option.id}`,
    type: 'tableCloth',
    optionId: option.id,
    name: option.label,
    price: 360 + idx * 35,
    description: "Swap in a premium felt tone for your poker table.",
    thumbnail: option.thumbnail
  })),
  ...TABLE_BASE_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-base-${option.id}`,
    type: 'tableBase',
    optionId: option.id,
    name: option.label,
    price: 420 + idx * 35,
    description: 'Upgrade the pedestal finish beneath your Hold\'em surface.',
    thumbnail: option.thumbnail
  })),
  ...TEXAS_CHAIR_THEME_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-chair-${option.id}`,
    type: 'chairTheme',
    optionId: option.id,
    name: option.label,
    price: option.price ?? 340 + idx * 30,
    description: option.description || 'Unlock a premium lounge chair model from Murlan Royale.',
    thumbnail: option.thumbnail
  })),
  ...TEXAS_TABLE_THEME_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-table-${option.id}`,
    type: 'tableTheme',
    optionId: option.id,
    name: option.label,
    price: option.price ?? 980 + idx * 45,
    description: option.description || `${option.label} table model from the Murlan Royale set.`,
    thumbnail: option.thumbnail
  })),
  ...TEXAS_HDRI_OPTIONS.map((variant, idx) => ({
    id: `texas-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: variant.label,
    price: variant.price ?? 1400 + idx * 25,
    description: variant.description || 'Poly Haven HDRI environment used in Murlan Royale.',
    swatches: variant.swatches,
    thumbnail: variant.thumbnail
  })),
  ...TABLE_SHAPE_OPTIONS.slice(1).map((option, idx) => ({
    id: `texas-shape-${option.id}`,
    type: 'tableShape',
    optionId: option.id,
    name: option.label,
    price: 680 + idx * 80,
    description: 'Change the poker table silhouette.',
    thumbnail: option.thumbnail
  })),
  ...CARD_THEMES.slice(1).map((option, idx) => ({
    id: `texas-card-${option.id}`,
    type: 'cards',
    optionId: option.id,
    name: `${option.label} Cards`,
    price: 460 + idx * 35,
    description: 'Add a fresh premium deck style to the arena.',
    thumbnail: option.thumbnail
  }))
];

export const TEXAS_HOLDEM_DEFAULT_LOADOUT = [
  {
    type: 'tableFinish',
    optionId: TEXAS_TABLE_FINISH_OPTIONS[0]?.id,
    label: TEXAS_TABLE_FINISH_OPTIONS[0]?.label
  },
  { type: 'tableWood', optionId: TABLE_WOOD_OPTIONS[0]?.id, label: TABLE_WOOD_OPTIONS[0]?.label },
  { type: 'tableCloth', optionId: TABLE_CLOTH_OPTIONS[0]?.id, label: TABLE_CLOTH_OPTIONS[0]?.label },
  { type: 'tableBase', optionId: TABLE_BASE_OPTIONS[0]?.id, label: TABLE_BASE_OPTIONS[0]?.label },
  { type: 'chairTheme', optionId: TEXAS_CHAIR_THEME_OPTIONS[0]?.id, label: TEXAS_CHAIR_THEME_OPTIONS[0]?.label },
  { type: 'tableTheme', optionId: TEXAS_TABLE_THEME_OPTIONS[0]?.id, label: TEXAS_TABLE_THEME_OPTIONS[0]?.label },
  { type: 'tableShape', optionId: TABLE_SHAPE_OPTIONS[0]?.id, label: TABLE_SHAPE_OPTIONS[0]?.label },
  { type: 'cards', optionId: CARD_THEMES[0]?.id, label: `${CARD_THEMES[0]?.label} Cards` },
  {
    type: 'environmentHdri',
    optionId: TEXAS_DEFAULT_HDRI_ID,
    label: TEXAS_HOLDEM_OPTION_LABELS.environmentHdri?.[TEXAS_DEFAULT_HDRI_ID] || TEXAS_HDRI_OPTIONS[DEFAULT_HDRI_INDEX]?.label
  }
];
