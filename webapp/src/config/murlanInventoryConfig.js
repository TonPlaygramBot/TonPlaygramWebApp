import { CARD_THEMES } from '../utils/cardThemes.js';
import { POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';
import { MURLAN_TABLE_CLOTHS } from './murlanTableCloths.js';
import { MURLAN_TABLE_FINISHES } from './murlanTableFinishes.js';
import { MURLAN_OUTFIT_THEMES, MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';

const mapLabels = (options) =>
  Object.freeze(
    options.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  );

export const MURLAN_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  outfit: [MURLAN_OUTFIT_THEMES[0].id],
  cards: [CARD_THEMES[0].id],
  stools: [MURLAN_STOOL_THEMES[0].id],
  tables: [MURLAN_TABLE_THEMES[0].id],
  tableCloth: [MURLAN_TABLE_CLOTHS[0].id],
  tableFinish: [MURLAN_TABLE_FINISHES[0].id],
  environmentHdri: POOL_ROYALE_HDRI_VARIANTS.map((variant) => variant.id)
});

export const MURLAN_ROYALE_OPTION_LABELS = Object.freeze({
  outfit: mapLabels(MURLAN_OUTFIT_THEMES),
  cards: mapLabels(CARD_THEMES),
  stools: mapLabels(MURLAN_STOOL_THEMES),
  tables: mapLabels(MURLAN_TABLE_THEMES),
  tableCloth: mapLabels(MURLAN_TABLE_CLOTHS),
  tableFinish: mapLabels(MURLAN_TABLE_FINISHES),
  environmentHdri: mapLabels(
    POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
      id: variant.id,
      label: `${variant.name} HDRI`
    }))
  )
});

export const MURLAN_ROYALE_STORE_ITEMS = [
  ...MURLAN_TABLE_FINISHES.map((finish, idx) => ({
    id: `table-finish-${finish.id}`,
    type: 'tableFinish',
    optionId: finish.id,
    name: finish.label,
    price: finish.price ?? 980 + idx * 40,
    description: finish.description,
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'table'
  })),
  {
    id: 'cards-solstice',
    type: 'cards',
    optionId: 'solstice',
    name: 'Solstice Deck',
    price: 260,
    description: 'Sun-baked backs with warm metallic edgework.',
    thumbnail: CARD_THEMES.find((theme) => theme.id === 'solstice')?.thumbnail
  },
  {
    id: 'cards-nebula',
    type: 'cards',
    optionId: 'nebula',
    name: 'Nebula Deck',
    price: 300,
    description: 'Cosmic purples with glowing starlit accents.',
    thumbnail: CARD_THEMES.find((theme) => theme.id === 'nebula')?.thumbnail
  },
  {
    id: 'cards-jade',
    type: 'cards',
    optionId: 'jade',
    name: 'Jade Deck',
    price: 280,
    description: 'Emerald gradients with luminous jade borders.',
    thumbnail: CARD_THEMES.find((theme) => theme.id === 'jade')?.thumbnail
  },
  {
    id: 'cards-ember',
    type: 'cards',
    optionId: 'ember',
    name: 'Ember Deck',
    price: 320,
    description: 'Fiery orange backs with charcoal cores.',
    thumbnail: CARD_THEMES.find((theme) => theme.id === 'ember')?.thumbnail
  },
  {
    id: 'cards-onyx',
    type: 'cards',
    optionId: 'onyx',
    name: 'Onyx Deck',
    price: 340,
    description: 'Monochrome slate backs with steel edging.',
    thumbnail: CARD_THEMES.find((theme) => theme.id === 'onyx')?.thumbnail
  }
].concat(
  MURLAN_OUTFIT_THEMES.filter((theme, idx) => idx > 0).map((theme, idx) => ({
    id: `outfit-${theme.id}`,
    type: 'outfit',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 540 + idx * 45,
    description: theme.description || `${theme.label} player model with original textures.`,
    thumbnail: theme.thumbnail
  })),
  MURLAN_TABLE_CLOTHS.map((cloth, idx) => ({
    id: `cloth-${cloth.id}`,
    type: 'tableCloth',
    optionId: cloth.id,
    name: cloth.label,
    price: cloth.price ?? 640 + idx * 20,
    description: cloth.description,
    swatches: cloth.swatches,
    thumbnail: cloth.thumbnail,
    previewShape: 'table'
  })),
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
    description: theme.description || `Premium ${theme.label} seating with original finish.`,
    thumbnail: theme.thumbnail
  })),
  POOL_ROYALE_HDRI_VARIANTS.map((variant, idx) => ({
    id: `hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price ?? 1400 + idx * 25,
    description: variant.description || 'Pool Royale HDRI environment tuned for Murlan promos.',
    swatches: variant.swatches,
    thumbnail: variant.thumbnail,
    previewShape: 'table'
  }))
);

export const MURLAN_ROYALE_DEFAULT_LOADOUT = [
  { type: 'outfit', optionId: MURLAN_OUTFIT_THEMES[0].id, label: MURLAN_OUTFIT_THEMES[0].label },
  { type: 'cards', optionId: CARD_THEMES[0].id, label: CARD_THEMES[0].label },
  { type: 'tables', optionId: MURLAN_TABLE_THEMES[0].id, label: MURLAN_TABLE_THEMES[0].label },
  { type: 'stools', optionId: MURLAN_STOOL_THEMES[0].id, label: MURLAN_STOOL_THEMES[0].label },
  {
    type: 'tableCloth',
    optionId: MURLAN_TABLE_CLOTHS[0].id,
    label: MURLAN_TABLE_CLOTHS[0].label
  },
  {
    type: 'tableFinish',
    optionId: MURLAN_TABLE_FINISHES[0].id,
    label: MURLAN_TABLE_FINISHES[0].label
  },
  {
    type: 'environmentHdri',
    optionId: POOL_ROYALE_DEFAULT_HDRI_ID,
    label:
      MURLAN_ROYALE_OPTION_LABELS.environmentHdri[POOL_ROYALE_DEFAULT_HDRI_ID] || 'HDR Environment'
  }
];
