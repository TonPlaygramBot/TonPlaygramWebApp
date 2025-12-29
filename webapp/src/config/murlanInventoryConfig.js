import { TABLE_BASE_OPTIONS, TABLE_CLOTH_OPTIONS, TABLE_WOOD_OPTIONS } from '../utils/tableCustomizationOptions.js';
import { CARD_THEMES } from '../utils/cardThemes.js';
import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANT_MAP,
  POOL_ROYALE_HDRI_VARIANTS
} from './poolRoyaleInventoryConfig.js';

const DEFAULT_HDRI_ID = POOL_ROYALE_DEFAULT_HDRI_ID || POOL_ROYALE_HDRI_VARIANTS[0]?.id;

const mapLabels = (options) =>
  Object.freeze(
    options.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  );

export const MURLAN_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: [TABLE_WOOD_OPTIONS[0].id],
  tableCloth: [TABLE_CLOTH_OPTIONS[0].id],
  tableBase: [TABLE_BASE_OPTIONS[0].id],
  cards: [CARD_THEMES[0].id],
  stools: [MURLAN_STOOL_THEMES[0].id],
  tables: [MURLAN_TABLE_THEMES[0].id],
  environmentHdri: [DEFAULT_HDRI_ID]
});

export const MURLAN_ROYALE_OPTION_LABELS = Object.freeze({
  tableWood: mapLabels(TABLE_WOOD_OPTIONS),
  tableCloth: mapLabels(TABLE_CLOTH_OPTIONS),
  tableBase: mapLabels(TABLE_BASE_OPTIONS),
  cards: mapLabels(CARD_THEMES),
  stools: mapLabels(MURLAN_STOOL_THEMES),
  tables: mapLabels(MURLAN_TABLE_THEMES),
  environmentHdri: Object.freeze(
    POOL_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
      acc[variant.id] = `${variant.name} HDRI`;
      return acc;
    }, {})
  )
});

export const MURLAN_ROYALE_STORE_ITEMS = [
  {
    id: 'wood-warmBrown',
    type: 'tableWood',
    optionId: 'warmBrown',
    name: 'Warm Brown Table Wood',
    price: 760,
    description: 'Walnut tone rails with a gentle satin sheen.'
  },
  {
    id: 'wood-cleanStrips',
    type: 'tableWood',
    optionId: 'cleanStrips',
    name: 'Clean Strips Table Wood',
    price: 840,
    description: 'Striped oak planks with a studio polish.'
  },
  {
    id: 'wood-oldWoodFloor',
    type: 'tableWood',
    optionId: 'oldWoodFloor',
    name: 'Heritage Wood Table',
    price: 920,
    description: 'Vintage smoked boards with deep grain detail.'
  },
  ...TABLE_CLOTH_OPTIONS.slice(1).map((option, idx) => ({
    id: `cloth-${option.id}`,
    type: 'tableCloth',
    optionId: option.id,
    name: option.label,
    price: 360 + idx * 20,
    description: `Premium ${option.label} felt for the Murlan table.`
  })),
  {
    id: 'base-forestBronze',
    type: 'tableBase',
    optionId: 'forestBronze',
    name: 'Forest Base',
    price: 620,
    description: 'Verdant metallic base with bronzed trim.'
  },
  {
    id: 'base-midnightChrome',
    type: 'tableBase',
    optionId: 'midnightChrome',
    name: 'Midnight Base',
    price: 690,
    description: 'Midnight blue base with chrome-inspired highlights.'
  },
  {
    id: 'base-emberCopper',
    type: 'tableBase',
    optionId: 'emberCopper',
    name: 'Copper Base',
    price: 740,
    description: 'Copper-accent base with warm metallic glints.'
  },
  {
    id: 'base-violetShadow',
    type: 'tableBase',
    optionId: 'violetShadow',
    name: 'Violet Shadow Base',
    price: 780,
    description: 'Shadowed violet base with luxe gloss trim.'
  },
  {
    id: 'base-desertGold',
    type: 'tableBase',
    optionId: 'desertGold',
    name: 'Desert Base',
    price: 820,
    description: 'Desert-inspired base with brushed gold finish.'
  },
  {
    id: 'cards-solstice',
    type: 'cards',
    optionId: 'solstice',
    name: 'Solstice Deck',
    price: 260,
    description: 'Sun-baked backs with warm metallic edgework.'
  },
  {
    id: 'cards-nebula',
    type: 'cards',
    optionId: 'nebula',
    name: 'Nebula Deck',
    price: 300,
    description: 'Cosmic purples with glowing starlit accents.'
  },
  {
    id: 'cards-jade',
    type: 'cards',
    optionId: 'jade',
    name: 'Jade Deck',
    price: 280,
    description: 'Emerald gradients with luminous jade borders.'
  },
  {
    id: 'cards-ember',
    type: 'cards',
    optionId: 'ember',
    name: 'Ember Deck',
    price: 320,
    description: 'Fiery orange backs with charcoal cores.'
  },
  {
    id: 'cards-onyx',
    type: 'cards',
    optionId: 'onyx',
    name: 'Onyx Deck',
    price: 340,
    description: 'Monochrome slate backs with steel edging.'
  }
].concat(
  MURLAN_TABLE_THEMES.filter((theme, idx) => idx > 0).map((theme, idx) => ({
    id: `table-${theme.id}`,
    type: 'tables',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 980 + idx * 40,
    description: theme.description || `${theme.label} table with preserved Poly Haven materials.`,
    thumbnail: theme.thumbnail
  })),
  MURLAN_STOOL_THEMES.filter((theme, idx) => idx > 0).map((theme, idx) => ({
    id: `stool-${theme.id}`,
    type: 'stools',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 300 + idx * 20,
    description: theme.description || `Premium ${theme.label} seating with original finish.`
  })),
  ...POOL_ROYALE_HDRI_VARIANTS.map((variant, idx) => ({
    id: `murlan-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price ?? 1400 + idx * 30,
    description: 'Pool Royale HDRI environment tuned for Murlan Royale promos.',
    thumbnail:
      variant.assetId || variant.id
        ? `https://cdn.polyhaven.com/asset_img/thumbs/${variant.assetId || variant.id}.png?width=320&height=180`
        : undefined
  }))
);

export const MURLAN_ROYALE_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: TABLE_WOOD_OPTIONS[0].id, label: TABLE_WOOD_OPTIONS[0].label },
  { type: 'tableCloth', optionId: TABLE_CLOTH_OPTIONS[0].id, label: TABLE_CLOTH_OPTIONS[0].label },
  { type: 'tableBase', optionId: TABLE_BASE_OPTIONS[0].id, label: TABLE_BASE_OPTIONS[0].label },
  { type: 'cards', optionId: CARD_THEMES[0].id, label: CARD_THEMES[0].label },
  { type: 'tables', optionId: MURLAN_TABLE_THEMES[0].id, label: MURLAN_TABLE_THEMES[0].label },
  { type: 'stools', optionId: MURLAN_STOOL_THEMES[0].id, label: MURLAN_STOOL_THEMES[0].label },
  {
    type: 'environmentHdri',
    optionId: DEFAULT_HDRI_ID,
    label: MURLAN_ROYALE_OPTION_LABELS.environmentHdri[DEFAULT_HDRI_ID] || 'HDR Environment'
  }
];

export const MURLAN_HDRI_VARIANTS = POOL_ROYALE_HDRI_VARIANTS;
export const MURLAN_HDRI_VARIANT_MAP = POOL_ROYALE_HDRI_VARIANT_MAP;
export const MURLAN_DEFAULT_HDRI_ID = DEFAULT_HDRI_ID;
