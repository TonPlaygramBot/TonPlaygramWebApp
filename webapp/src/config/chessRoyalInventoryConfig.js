import { TABLE_WOOD_OPTIONS, TABLE_CLOTH_OPTIONS, TABLE_BASE_OPTIONS } from '../utils/tableCustomizationOptions.js';
import { TABLE_SHAPE_OPTIONS } from '../utils/murlanTable.js';

const CHAIR_COLOR_OPTIONS = [
  {
    id: 'crimsonVelvet',
    label: 'Crimson Velvet'
  },
  {
    id: 'midnightNavy',
    label: 'Midnight Blue'
  },
  {
    id: 'emeraldWave',
    label: 'Emerald Wave'
  },
  {
    id: 'onyxShadow',
    label: 'Onyx Shadow'
  },
  {
    id: 'royalPlum',
    label: 'Royal Chestnut'
  }
];

const TABLE_SHAPE_MENU_OPTIONS = TABLE_SHAPE_OPTIONS.filter((option) => option.id !== 'diamondEdge');

export const CHESS_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: [TABLE_WOOD_OPTIONS[0]?.id].filter(Boolean),
  tableCloth: [TABLE_CLOTH_OPTIONS[0]?.id].filter(Boolean),
  tableBase: [TABLE_BASE_OPTIONS[0]?.id].filter(Boolean),
  chairColor: [CHAIR_COLOR_OPTIONS[0]?.id].filter(Boolean),
  tableShape: [TABLE_SHAPE_MENU_OPTIONS[0]?.id].filter(Boolean)
});

export const CHESS_ROYALE_OPTION_LABELS = Object.freeze({
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
  chairColor: Object.freeze(
    CHAIR_COLOR_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  tableShape: Object.freeze(
    TABLE_SHAPE_MENU_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  )
});

export const CHESS_ROYALE_STORE_ITEMS = [
  {
    id: 'wood-warmBrown',
    type: 'tableWood',
    optionId: 'warmBrown',
    name: 'Warm Brown Oak',
    price: 740,
    description: 'Walnut-toned rails and trims styled for the chess arena.'
  },
  {
    id: 'wood-cleanStrips',
    type: 'tableWood',
    optionId: 'cleanStrips',
    name: 'Clean Strips Studio',
    price: 780,
    description: 'Linear oak slats with soft sheen for a studio look.'
  },
  {
    id: 'wood-oldWoodFloor',
    type: 'tableWood',
    optionId: 'oldWoodFloor',
    name: 'Heritage Timber',
    price: 820,
    description: 'Weathered timber with deep grain for a dramatic stage.'
  },
  {
    id: 'cloth-emerald',
    type: 'tableCloth',
    optionId: 'emerald',
    name: 'Emerald Cloth',
    price: 520,
    description: 'Rich green cloth with deep shadows and glow.'
  },
  {
    id: 'cloth-arctic',
    type: 'tableCloth',
    optionId: 'arctic',
    name: 'Arctic Cloth',
    price: 540,
    description: 'Cool blue felt for a clean, icy arena feel.'
  },
  {
    id: 'cloth-sunset',
    type: 'tableCloth',
    optionId: 'sunset',
    name: 'Sunset Cloth',
    price: 560,
    description: 'Copper-orange felt with warm gradient highlights.'
  },
  {
    id: 'cloth-violet',
    type: 'tableCloth',
    optionId: 'violet',
    name: 'Violet Cloth',
    price: 580,
    description: 'Royal violet felt with luminous edges.'
  },
  {
    id: 'cloth-amber',
    type: 'tableCloth',
    optionId: 'amber',
    name: 'Amber Cloth',
    price: 600,
    description: 'Golden amber felt with soft vignette lighting.'
  },
  {
    id: 'base-forestBronze',
    type: 'tableBase',
    optionId: 'forestBronze',
    name: 'Forest Column',
    price: 670,
    description: 'Dark forest base with bronze accents and matte metal.'
  },
  {
    id: 'base-midnightChrome',
    type: 'tableBase',
    optionId: 'midnightChrome',
    name: 'Midnight Column',
    price: 690,
    description: 'Indigo steel frame with chrome-like trim.'
  },
  {
    id: 'base-emberCopper',
    type: 'tableBase',
    optionId: 'emberCopper',
    name: 'Ember Column',
    price: 710,
    description: 'Copper and ember-tinted base for dramatic contrast.'
  },
  {
    id: 'base-violetShadow',
    type: 'tableBase',
    optionId: 'violetShadow',
    name: 'Violet Shadow Column',
    price: 740,
    description: 'Violet-black base with shimmering trims.'
  },
  {
    id: 'base-desertGold',
    type: 'tableBase',
    optionId: 'desertGold',
    name: 'Desert Gold Column',
    price: 760,
    description: 'Warm desert-toned base with satin gold trims.'
  },
  {
    id: 'chair-midnightNavy',
    type: 'chairColor',
    optionId: 'midnightNavy',
    name: 'Midnight Chairs',
    price: 460,
    description: 'Deep navy upholstery with subtle highlights.'
  },
  {
    id: 'chair-emeraldWave',
    type: 'chairColor',
    optionId: 'emeraldWave',
    name: 'Emerald Chairs',
    price: 470,
    description: 'Emerald seating with rich accent stitching.'
  },
  {
    id: 'chair-onyxShadow',
    type: 'chairColor',
    optionId: 'onyxShadow',
    name: 'Onyx Chairs',
    price: 480,
    description: 'Shadowed onyx upholstery with metallic legs.'
  },
  {
    id: 'chair-royalPlum',
    type: 'chairColor',
    optionId: 'royalPlum',
    name: 'Royal Chestnut Chairs',
    price: 520,
    description: 'Royal plum seating with chestnut undertones.'
  },
  {
    id: 'shape-grandOval',
    type: 'tableShape',
    optionId: 'grandOval',
    name: 'Grand Oval Table',
    price: 820,
    description: 'Sweeping oval table shape with wide apron.'
  }
];

export const CHESS_ROYALE_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: TABLE_WOOD_OPTIONS[0]?.id, label: TABLE_WOOD_OPTIONS[0]?.label },
  { type: 'tableCloth', optionId: TABLE_CLOTH_OPTIONS[0]?.id, label: TABLE_CLOTH_OPTIONS[0]?.label },
  { type: 'tableBase', optionId: TABLE_BASE_OPTIONS[0]?.id, label: TABLE_BASE_OPTIONS[0]?.label },
  { type: 'chairColor', optionId: CHAIR_COLOR_OPTIONS[0]?.id, label: CHAIR_COLOR_OPTIONS[0]?.label },
  { type: 'tableShape', optionId: TABLE_SHAPE_MENU_OPTIONS[0]?.id, label: TABLE_SHAPE_MENU_OPTIONS[0]?.label }
].filter((entry) => entry.type && entry.optionId && entry.label);

export { CHAIR_COLOR_OPTIONS, TABLE_SHAPE_MENU_OPTIONS };
