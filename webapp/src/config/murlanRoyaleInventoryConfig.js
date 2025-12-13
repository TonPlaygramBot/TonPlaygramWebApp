import { TABLE_BASE_OPTIONS, TABLE_CLOTH_OPTIONS, TABLE_WOOD_OPTIONS } from '../utils/tableCustomizationOptions.js';
import { CARD_THEMES } from '../utils/cardThemes.js';
import { OUTFIT_THEMES, STOOL_THEMES } from './murlanRoyaleAppearance.js';

export const MURLAN_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: [TABLE_WOOD_OPTIONS[0]?.id],
  tableCloth: [TABLE_CLOTH_OPTIONS[0]?.id],
  tableBase: [TABLE_BASE_OPTIONS[0]?.id],
  cards: [CARD_THEMES[0]?.id],
  stools: [STOOL_THEMES[0]?.id],
  outfit: [OUTFIT_THEMES[0]?.id]
});

export const MURLAN_OPTION_LABELS = Object.freeze({
  tableWood: Object.freeze(
    TABLE_WOOD_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  tableCloth: Object.freeze(
    TABLE_CLOTH_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  tableBase: Object.freeze(
    TABLE_BASE_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  cards: Object.freeze(
    CARD_THEMES.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  stools: Object.freeze(
    STOOL_THEMES.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  outfit: Object.freeze(
    OUTFIT_THEMES.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  )
});

export const MURLAN_STORE_ITEMS = [
  ...TABLE_WOOD_OPTIONS.slice(1).map((option, idx) => ({
    id: `murlan-wood-${option.id}`,
    type: 'tableWood',
    optionId: option.id,
    name: option.label,
    price: 520 + idx * 40,
    description: 'Alternate rail wood finish for the Murlan Royale table.'
  })),
  ...TABLE_CLOTH_OPTIONS.slice(1).map((option, idx) => ({
    id: `murlan-cloth-${option.id}`,
    type: 'tableCloth',
    optionId: option.id,
    name: option.label,
    price: 340 + idx * 30,
    description: 'Premium felt palette applied to the Murlan Royale playfield.'
  })),
  ...TABLE_BASE_OPTIONS.slice(1).map((option, idx) => ({
    id: `murlan-base-${option.id}`,
    type: 'tableBase',
    optionId: option.id,
    name: option.label,
    price: 460 + idx * 35,
    description: 'Pedestal and trim finish upgrade for the Murlan Royale base.'
  })),
  ...CARD_THEMES.slice(1).map((option, idx) => ({
    id: `murlan-cards-${option.id}`,
    type: 'cards',
    optionId: option.id,
    name: `${option.label} Card Theme`,
    price: 260 + idx * 28,
    description: 'Front and back artwork for the Murlan Royale deck.'
  })),
  ...STOOL_THEMES.slice(1).map((option, idx) => ({
    id: `murlan-stools-${option.id}`,
    type: 'stools',
    optionId: option.id,
    name: `${option.label} Lounge Stools`,
    price: 300 + idx * 35,
    description: 'Seat and leg colors for the arena stools.'
  })),
  ...OUTFIT_THEMES.slice(1).map((option, idx) => ({
    id: `murlan-outfit-${option.id}`,
    type: 'outfit',
    optionId: option.id,
    name: `${option.label} Outfit`,
    price: 340 + idx * 32,
    description: 'Player outfit palette applied to the dealer and avatars.'
  }))
];

export const MURLAN_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: TABLE_WOOD_OPTIONS[0]?.id, label: TABLE_WOOD_OPTIONS[0]?.label },
  { type: 'tableCloth', optionId: TABLE_CLOTH_OPTIONS[0]?.id, label: TABLE_CLOTH_OPTIONS[0]?.label },
  { type: 'tableBase', optionId: TABLE_BASE_OPTIONS[0]?.id, label: TABLE_BASE_OPTIONS[0]?.label },
  { type: 'cards', optionId: CARD_THEMES[0]?.id, label: CARD_THEMES[0]?.label },
  { type: 'stools', optionId: STOOL_THEMES[0]?.id, label: STOOL_THEMES[0]?.label },
  { type: 'outfit', optionId: OUTFIT_THEMES[0]?.id, label: OUTFIT_THEMES[0]?.label }
];
