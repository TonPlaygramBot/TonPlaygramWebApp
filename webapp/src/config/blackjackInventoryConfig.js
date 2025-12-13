import { TABLE_WOOD_OPTIONS, TABLE_CLOTH_OPTIONS } from '../utils/tableCustomizationOptions.js';
import { TABLE_SHAPE_OPTIONS } from '../utils/murlanTable.js';
import { CARD_THEMES } from '../utils/cards3d.js';
import { CHAIR_COLOR_OPTIONS } from './blackjackOptions.js';

const DEFAULT_TABLE_SHAPE_ID = TABLE_SHAPE_OPTIONS[0]?.id;

export const BLACKJACK_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: [TABLE_WOOD_OPTIONS[0]?.id],
  tableCloth: [TABLE_CLOTH_OPTIONS[0]?.id],
  chairColor: [CHAIR_COLOR_OPTIONS[0]?.id],
  tableShape: [DEFAULT_TABLE_SHAPE_ID],
  cards: [CARD_THEMES[0]?.id]
});

export const BLACKJACK_OPTION_LABELS = Object.freeze({
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
  chairColor: Object.freeze(
    CHAIR_COLOR_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  tableShape: Object.freeze(
    TABLE_SHAPE_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  cards: Object.freeze(
    CARD_THEMES.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  )
});

export const BLACKJACK_STORE_ITEMS = [
  ...TABLE_WOOD_OPTIONS.slice(1).map((option, idx) => ({
    id: `blackjack-wood-${option.id}`,
    type: 'tableWood',
    optionId: option.id,
    name: option.label,
    price: 440 + idx * 35,
    description: 'Premium blackjack table wood finish.'
  })),
  ...TABLE_CLOTH_OPTIONS.slice(1).map((option, idx) => ({
    id: `blackjack-cloth-${option.id}`,
    type: 'tableCloth',
    optionId: option.id,
    name: option.label,
    price: 320 + idx * 30,
    description: 'Alternate felt palette for your blackjack arena.'
  })),
  ...CHAIR_COLOR_OPTIONS.slice(1).map((option, idx) => ({
    id: `blackjack-chair-${option.id}`,
    type: 'chairColor',
    optionId: option.id,
    name: `${option.label} Chairs`,
    price: 280 + idx * 25,
    description: 'Unlocks an extra lounge chair finish for the table.'
  })),
  ...TABLE_SHAPE_OPTIONS.slice(1).map((option, idx) => ({
    id: `blackjack-shape-${option.id}`,
    type: 'tableShape',
    optionId: option.id,
    name: `${option.label} Shape`,
    price: 650 + idx * 45,
    description: 'Adds an extra table silhouette to the setup menu.'
  })),
  ...CARD_THEMES.slice(1).map((option, idx) => ({
    id: `blackjack-cards-${option.id}`,
    type: 'cards',
    optionId: option.id,
    name: `${option.label} Deck`,
    price: 360 + idx * 28,
    description: 'New card back and face style for blackjack hands.'
  }))
];

export const BLACKJACK_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: TABLE_WOOD_OPTIONS[0]?.id, label: TABLE_WOOD_OPTIONS[0]?.label },
  { type: 'tableCloth', optionId: TABLE_CLOTH_OPTIONS[0]?.id, label: TABLE_CLOTH_OPTIONS[0]?.label },
  { type: 'chairColor', optionId: CHAIR_COLOR_OPTIONS[0]?.id, label: CHAIR_COLOR_OPTIONS[0]?.label },
  { type: 'tableShape', optionId: DEFAULT_TABLE_SHAPE_ID, label: BLACKJACK_OPTION_LABELS.tableShape[DEFAULT_TABLE_SHAPE_ID] },
  { type: 'cards', optionId: CARD_THEMES[0]?.id, label: CARD_THEMES[0]?.label }
];
