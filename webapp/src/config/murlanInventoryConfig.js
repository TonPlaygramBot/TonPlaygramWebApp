import { TABLE_WOOD_OPTIONS, TABLE_CLOTH_OPTIONS, TABLE_BASE_OPTIONS } from '../utils/tableCustomizationOptions.js';
import { CARD_THEMES } from '../utils/cardThemes.js';
import { OUTFIT_THEMES, STOOL_THEMES } from './murlanAppearanceOptions.js';

const DEFAULT_TABLE_WOOD_ID = TABLE_WOOD_OPTIONS[0]?.id;
const DEFAULT_TABLE_CLOTH_ID = TABLE_CLOTH_OPTIONS[0]?.id;
const DEFAULT_TABLE_BASE_ID = TABLE_BASE_OPTIONS[0]?.id;
const DEFAULT_CARD_THEME_ID = CARD_THEMES[0]?.id;
const DEFAULT_STOOL_ID = STOOL_THEMES[0]?.id;
const DEFAULT_OUTFIT_ID = OUTFIT_THEMES[0]?.id;

export const MURLAN_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: [DEFAULT_TABLE_WOOD_ID],
  tableCloth: [DEFAULT_TABLE_CLOTH_ID],
  tableBase: [DEFAULT_TABLE_BASE_ID],
  cards: [DEFAULT_CARD_THEME_ID],
  stools: [DEFAULT_STOOL_ID],
  outfit: [DEFAULT_OUTFIT_ID]
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
    price: 540 + idx * 35,
    description: 'Premium oak and walnut finishes for the card table rails.'
  })),
  ...TABLE_CLOTH_OPTIONS.slice(1).map((option, idx) => ({
    id: `murlan-cloth-${option.id}`,
    type: 'tableCloth',
    optionId: option.id,
    name: option.label,
    price: 360 + idx * 25,
    description: 'Tournament-grade cloth hues for the arena felt.'
  })),
  ...TABLE_BASE_OPTIONS.slice(1).map((option, idx) => ({
    id: `murlan-base-${option.id}`,
    type: 'tableBase',
    optionId: option.id,
    name: option.label,
    price: 420 + idx * 30,
    description: 'Alternate pedestal finishes for the Murlan Royale stage.'
  })),
  ...CARD_THEMES.slice(1).map((option, idx) => ({
    id: `murlan-cards-${option.id}`,
    type: 'cards',
    optionId: option.id,
    name: `${option.label} Cards`,
    price: 300 + idx * 30,
    description: 'NFT-backed card backs and edge treatments.'
  })),
  ...STOOL_THEMES.slice(1).map((option, idx) => ({
    id: `murlan-stool-${option.id}`,
    type: 'stools',
    optionId: option.id,
    name: `${option.label} Stools`,
    price: 280 + idx * 25,
    description: 'Alternate spectator stool upholstery and leg finishes.'
  })),
  ...OUTFIT_THEMES.slice(1).map((option, idx) => ({
    id: `murlan-outfit-${option.id}`,
    type: 'outfit',
    optionId: option.id,
    name: `${option.label} Outfit`,
    price: 360 + idx * 35,
    description: 'Outfit palette unlocks for the table attendants.'
  }))
];

export const MURLAN_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: DEFAULT_TABLE_WOOD_ID, label: MURLAN_OPTION_LABELS.tableWood[DEFAULT_TABLE_WOOD_ID] },
  { type: 'tableCloth', optionId: DEFAULT_TABLE_CLOTH_ID, label: MURLAN_OPTION_LABELS.tableCloth[DEFAULT_TABLE_CLOTH_ID] },
  { type: 'tableBase', optionId: DEFAULT_TABLE_BASE_ID, label: MURLAN_OPTION_LABELS.tableBase[DEFAULT_TABLE_BASE_ID] },
  { type: 'cards', optionId: DEFAULT_CARD_THEME_ID, label: `${MURLAN_OPTION_LABELS.cards[DEFAULT_CARD_THEME_ID]} Cards` },
  { type: 'stools', optionId: DEFAULT_STOOL_ID, label: `${MURLAN_OPTION_LABELS.stools[DEFAULT_STOOL_ID]} Stools` },
  { type: 'outfit', optionId: DEFAULT_OUTFIT_ID, label: `${MURLAN_OPTION_LABELS.outfit[DEFAULT_OUTFIT_ID]} Outfit` }
];
