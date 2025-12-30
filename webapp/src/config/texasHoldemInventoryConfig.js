import { CARD_THEMES } from '../utils/cards3d.js';
import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';
import { POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';

const reduceLabels = (items) =>
  items.reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {});

export const TEXAS_HOLDEM_DEFAULT_UNLOCKS = Object.freeze({
  tables: [MURLAN_TABLE_THEMES[0]?.id],
  stools: [MURLAN_STOOL_THEMES[0]?.id],
  environmentHdri: POOL_ROYALE_HDRI_VARIANTS.map((variant) => variant.id),
  cards: [CARD_THEMES[0]?.id]
});

export const TEXAS_HOLDEM_OPTION_LABELS = Object.freeze({
  tables: Object.freeze(reduceLabels(MURLAN_TABLE_THEMES)),
  stools: Object.freeze(reduceLabels(MURLAN_STOOL_THEMES)),
  environmentHdri: Object.freeze(
    reduceLabels(
      POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
        id: variant.id,
        label: `${variant.name} HDRI`
      }))
    )
  ),
  cards: Object.freeze(reduceLabels(CARD_THEMES))
});

export const TEXAS_HOLDEM_STORE_ITEMS = [
  ...MURLAN_TABLE_THEMES.filter((theme, idx) => idx > 0).map((theme, idx) => ({
    id: `texas-table-${theme.id}`,
    type: 'tables',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 980 + idx * 40,
    description: theme.description || `${theme.label} table with preserved Poly Haven materials.`,
    thumbnail: theme.thumbnail
  })),
  ...MURLAN_STOOL_THEMES.filter((theme, idx) => idx > 0).map((theme, idx) => ({
    id: `texas-stool-${theme.id}`,
    type: 'stools',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 300 + idx * 20,
    description: theme.description || `Premium ${theme.label} seating with original finish.`
  })),
  ...POOL_ROYALE_HDRI_VARIANTS.map((variant, idx) => ({
    id: `texas-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price ?? 1400 + idx * 25,
    description: variant.description || 'Pool Royale HDRI environment tuned for poker tables.',
    swatches: variant.swatches,
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
  { type: 'tables', optionId: MURLAN_TABLE_THEMES[0]?.id, label: MURLAN_TABLE_THEMES[0]?.label },
  { type: 'stools', optionId: MURLAN_STOOL_THEMES[0]?.id, label: MURLAN_STOOL_THEMES[0]?.label },
  {
    type: 'environmentHdri',
    optionId: POOL_ROYALE_DEFAULT_HDRI_ID,
    label: TEXAS_HOLDEM_OPTION_LABELS.environmentHdri[POOL_ROYALE_DEFAULT_HDRI_ID] || 'HDR Environment'
  },
  { type: 'cards', optionId: CARD_THEMES[0]?.id, label: `${CARD_THEMES[0]?.label} Cards` }
];
