import { CARD_THEMES } from '../utils/cards3d.js';
import { DOMINO_ROYAL_OPTION_SETS } from './dominoRoyalInventoryConfig.js';
import { MURLAN_CHARACTER_THEMES } from './murlanCharacterThemes.js';
import { MURLAN_OUTFIT_THEMES } from './murlanThemes.js';

const mapLabels = (options) =>
  Object.freeze(
    options.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  );

const MURLAN_GRAPHICS_OPTION_SETS = Object.freeze({
  stools: DOMINO_ROYAL_OPTION_SETS.chairTheme,
  tables: DOMINO_ROYAL_OPTION_SETS.tableTheme,
  tableCloth: DOMINO_ROYAL_OPTION_SETS.tableCloth,
  tableFinish: DOMINO_ROYAL_OPTION_SETS.tableWood,
  environmentHdri: DOMINO_ROYAL_OPTION_SETS.environmentHdri
});

const DEFAULT_MURLAN_SHARED_IDS = Object.freeze({
  stool: 'dining_chair_02',
  table: 'murlan-default',
  tableCloth: 'emerald',
  tableFinish: 'peelingPaintWeathered',
  environmentHdri: 'neon_photostudio'
});

export const MURLAN_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  outfit: [MURLAN_OUTFIT_THEMES[0].id],
  cards: [CARD_THEMES[0].id],
  stools: [DEFAULT_MURLAN_SHARED_IDS.stool],
  tables: [DEFAULT_MURLAN_SHARED_IDS.table],
  tableCloth: [DEFAULT_MURLAN_SHARED_IDS.tableCloth],
  tableFinish: [DEFAULT_MURLAN_SHARED_IDS.tableFinish],
  characters: [MURLAN_CHARACTER_THEMES[0].id],
  environmentHdri: MURLAN_GRAPHICS_OPTION_SETS.environmentHdri.map((variant) => variant.id)
});

export const MURLAN_ROYALE_OPTION_LABELS = Object.freeze({
  outfit: mapLabels(MURLAN_OUTFIT_THEMES),
  cards: mapLabels(CARD_THEMES),
  stools: mapLabels(MURLAN_GRAPHICS_OPTION_SETS.stools),
  tables: mapLabels(MURLAN_GRAPHICS_OPTION_SETS.tables),
  tableCloth: mapLabels(MURLAN_GRAPHICS_OPTION_SETS.tableCloth),
  tableFinish: mapLabels(MURLAN_GRAPHICS_OPTION_SETS.tableFinish),
  characters: mapLabels(MURLAN_CHARACTER_THEMES),
  environmentHdri: mapLabels(MURLAN_GRAPHICS_OPTION_SETS.environmentHdri)
});

export const MURLAN_ROYALE_STORE_ITEMS = [
  ...MURLAN_GRAPHICS_OPTION_SETS.tableFinish.map((finish, idx) => ({
    id: `table-finish-${finish.id}`,
    type: 'tableFinish',
    optionId: finish.id,
    name: finish.label,
    price: finish.price ?? 980 + idx * 40,
    description: finish.description,
    thumbnail: finish.thumbnail,
    previewShape: 'table'
  })),
  ...CARD_THEMES.slice(1).map((option, idx) => ({
    id: `murlan-card-${option.id}`,
    type: 'cards',
    optionId: option.id,
    name: `${option.label} Cards`,
    price: 460 + idx * 35,
    description: 'Add a fresh premium deck style to the arena.',
    thumbnail: option.thumbnail
  }))
].concat(
  MURLAN_GRAPHICS_OPTION_SETS.tableCloth.map((cloth, idx) => ({
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
  MURLAN_GRAPHICS_OPTION_SETS.tables.filter((theme, idx) => idx > 0).map((theme, idx) => ({
    id: `table-${theme.id}`,
    type: 'tables',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 980 + idx * 40,
    description: theme.description || `${theme.label} table with preserved Poly Haven materials.`,
    thumbnail: theme.thumbnail
  })),
  MURLAN_GRAPHICS_OPTION_SETS.stools.filter((theme, idx) => idx > 0).map((theme, idx) => ({
    id: `stool-${theme.id}`,
    type: 'stools',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 300 + idx * 20,
    description: theme.description || `Premium ${theme.label} seating with original finish.`,
    thumbnail: theme.thumbnail
  })),
  MURLAN_CHARACTER_THEMES.filter((theme, idx) => idx > 0).map((theme, idx) => ({
    id: `character-${theme.id}`,
    type: 'characters',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 360 + idx * 30,
    description: theme.description,
    thumbnail: theme.thumbnail
  })),
  MURLAN_GRAPHICS_OPTION_SETS.environmentHdri.map((variant, idx) => ({
    id: `hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: variant.label,
    price: variant.price ?? 1400 + idx * 25,
    description: variant.description || 'Pool Royale HDRI environment tuned for Murlan promos.',
    thumbnail: variant.thumbnail,
    previewShape: 'table'
  }))
);

export const MURLAN_ROYALE_DEFAULT_LOADOUT = [
  { type: 'outfit', optionId: MURLAN_OUTFIT_THEMES[0].id, label: MURLAN_OUTFIT_THEMES[0].label },
  { type: 'cards', optionId: CARD_THEMES[0].id, label: CARD_THEMES[0].label },
  {
    type: 'tables',
    optionId:
      MURLAN_GRAPHICS_OPTION_SETS.tables.find((option) => option.id === DEFAULT_MURLAN_SHARED_IDS.table)?.id ||
      MURLAN_GRAPHICS_OPTION_SETS.tables[0].id,
    label:
      (MURLAN_GRAPHICS_OPTION_SETS.tables.find((option) => option.id === DEFAULT_MURLAN_SHARED_IDS.table) ||
        MURLAN_GRAPHICS_OPTION_SETS.tables[0]).label
  },
  {
    type: 'stools',
    optionId:
      MURLAN_GRAPHICS_OPTION_SETS.stools.find((option) => option.id === DEFAULT_MURLAN_SHARED_IDS.stool)?.id ||
      MURLAN_GRAPHICS_OPTION_SETS.stools[0].id,
    label:
      (MURLAN_GRAPHICS_OPTION_SETS.stools.find((option) => option.id === DEFAULT_MURLAN_SHARED_IDS.stool) ||
        MURLAN_GRAPHICS_OPTION_SETS.stools[0]).label
  },
  {
    type: 'characters',
    optionId: MURLAN_CHARACTER_THEMES[0].id,
    label: MURLAN_CHARACTER_THEMES[0].label
  },
  {
    type: 'tableCloth',
    optionId:
      MURLAN_GRAPHICS_OPTION_SETS.tableCloth.find((option) => option.id === DEFAULT_MURLAN_SHARED_IDS.tableCloth)
        ?.id || MURLAN_GRAPHICS_OPTION_SETS.tableCloth[0].id,
    label:
      (MURLAN_GRAPHICS_OPTION_SETS.tableCloth.find((option) => option.id === DEFAULT_MURLAN_SHARED_IDS.tableCloth) ||
        MURLAN_GRAPHICS_OPTION_SETS.tableCloth[0]).label
  },
  {
    type: 'tableFinish',
    optionId:
      MURLAN_GRAPHICS_OPTION_SETS.tableFinish.find((option) => option.id === DEFAULT_MURLAN_SHARED_IDS.tableFinish)
        ?.id || MURLAN_GRAPHICS_OPTION_SETS.tableFinish[0].id,
    label:
      (MURLAN_GRAPHICS_OPTION_SETS.tableFinish.find((option) => option.id === DEFAULT_MURLAN_SHARED_IDS.tableFinish) ||
        MURLAN_GRAPHICS_OPTION_SETS.tableFinish[0]).label
  },
  {
    type: 'environmentHdri',
    optionId: DEFAULT_MURLAN_SHARED_IDS.environmentHdri,
    label: MURLAN_ROYALE_OPTION_LABELS.environmentHdri[DEFAULT_MURLAN_SHARED_IDS.environmentHdri] || 'HDR Environment'
  }
];
