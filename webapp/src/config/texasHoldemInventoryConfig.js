import { POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';
import { CARD_THEMES } from '../utils/cards3d.js';
import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';

const reduceLabels = (items) =>
  items.reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {});

export const TEXAS_HOLDEM_DEFAULT_UNLOCKS = Object.freeze({
  tables: [MURLAN_TABLE_THEMES[0]?.id],
  stools: [MURLAN_STOOL_THEMES[0]?.id],
  environmentHdri: [POOL_ROYALE_DEFAULT_HDRI_ID],
  cards: [CARD_THEMES[0]?.id]
});

export const TEXAS_HOLDEM_OPTION_LABELS = Object.freeze({
  tables: Object.freeze(reduceLabels(MURLAN_TABLE_THEMES)),
  stools: Object.freeze(reduceLabels(MURLAN_STOOL_THEMES)),
  environmentHdri: Object.freeze(
    POOL_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
      acc[variant.id] = `${variant.name} HDRI`;
      return acc;
    }, {})
  ),
  cards: Object.freeze(reduceLabels(CARD_THEMES))
});

export const TEXAS_HOLDEM_STORE_ITEMS = [
  ...MURLAN_TABLE_THEMES.slice(1).map((option, idx) => ({
    id: `texas-table-${option.id}`,
    type: 'tables',
    optionId: option.id,
    name: option.label,
    price: option.price ?? 980 + idx * 40,
    description: 'Bring the latest Murlan Royale table models to the poker arena.'
  })),
  ...MURLAN_STOOL_THEMES.slice(1).map((option, idx) => ({
    id: `texas-stool-${option.id}`,
    type: 'stools',
    optionId: option.id,
    name: option.label,
    price: option.price ?? 520 + idx * 35,
    description: 'Seat players in the new Murlan Royale chair lineup.'
  })),
  ...POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
    id: `texas-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price,
    description: variant.description
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
  { type: 'tables', optionId: MURLAN_TABLE_THEMES[0]?.id, label: MURLAN_TABLE_THEMES[0]?.label },
  { type: 'stools', optionId: MURLAN_STOOL_THEMES[0]?.id, label: MURLAN_STOOL_THEMES[0]?.label },
  {
    type: 'environmentHdri',
    optionId: POOL_ROYALE_DEFAULT_HDRI_ID,
    label: `${POOL_ROYALE_HDRI_VARIANTS.find((variant) => variant.id === POOL_ROYALE_DEFAULT_HDRI_ID)?.name || 'HDRI'}`
  },
  { type: 'cards', optionId: CARD_THEMES[0]?.id, label: `${CARD_THEMES[0]?.label} Cards` }
];
