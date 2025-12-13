import {
  TABLE_WOOD_OPTIONS,
  TABLE_CLOTH_OPTIONS,
  TABLE_BASE_OPTIONS
} from '../utils/tableCustomizationOptions.js';
import { TABLE_SHAPE_OPTIONS } from '../utils/murlanTable.js';
import { CHAIR_COLOR_OPTIONS, QUICK_SIDE_COLORS } from './chessAppearanceOptions.js';

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
    TABLE_SHAPE_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  sideColor: Object.freeze(
    QUICK_SIDE_COLORS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  )
});

export const CHESS_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: [TABLE_WOOD_OPTIONS[0].id],
  tableCloth: [TABLE_CLOTH_OPTIONS[0].id, TABLE_CLOTH_OPTIONS[1].id],
  tableBase: [TABLE_BASE_OPTIONS[0].id],
  chairColor: [CHAIR_COLOR_OPTIONS[0].id],
  tableShape: [TABLE_SHAPE_OPTIONS[0].id],
  sideColor: ['amberGlow', 'mintVale']
});

export const CHESS_ROYALE_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: TABLE_WOOD_OPTIONS[0].id, label: TABLE_WOOD_OPTIONS[0].label },
  { type: 'tableCloth', optionId: TABLE_CLOTH_OPTIONS[1].id, label: TABLE_CLOTH_OPTIONS[1].label },
  { type: 'tableBase', optionId: TABLE_BASE_OPTIONS[0].id, label: TABLE_BASE_OPTIONS[0].label },
  { type: 'chairColor', optionId: CHAIR_COLOR_OPTIONS[0].id, label: CHAIR_COLOR_OPTIONS[0].label },
  { type: 'tableShape', optionId: TABLE_SHAPE_OPTIONS[0].id, label: TABLE_SHAPE_OPTIONS[0].label },
  { type: 'sideColor', optionId: 'amberGlow', label: CHESS_ROYALE_OPTION_LABELS.sideColor.amberGlow }
];

export const CHESS_ROYALE_STORE_ITEMS = [
  {
    id: 'wood-warmBrown',
    type: 'tableWood',
    optionId: 'warmBrown',
    name: 'Warm Brown Timber',
    price: 780,
    description: 'Rich walnut rails with deeper grain and warm tonality.'
  },
  {
    id: 'wood-cleanStrips',
    type: 'tableWood',
    optionId: 'cleanStrips',
    name: 'Clean Strips Oak',
    price: 820,
    description: 'Studio oak strips with modern satin finish.'
  },
  {
    id: 'wood-oldWood',
    type: 'tableWood',
    optionId: 'oldWoodFloor',
    name: 'Old Wood Floor',
    price: 900,
    description: 'Smoked oak planks with dramatic character marks.'
  },
  {
    id: 'cloth-arctic',
    type: 'tableCloth',
    optionId: 'arctic',
    name: 'Arctic Cloth',
    price: 420,
    description: 'Icy blue felt for a crisp tournament look.'
  },
  {
    id: 'cloth-sunset',
    type: 'tableCloth',
    optionId: 'sunset',
    name: 'Sunset Cloth',
    price: 460,
    description: 'Sunset orange felt with warm gradient shading.'
  },
  {
    id: 'cloth-violet',
    type: 'tableCloth',
    optionId: 'violet',
    name: 'Violet Cloth',
    price: 480,
    description: 'Deep violet felt with subtle glow.'
  },
  {
    id: 'cloth-amber',
    type: 'tableCloth',
    optionId: 'amber',
    name: 'Amber Cloth',
    price: 500,
    description: 'Amber-toned felt with warm highlights.'
  },
  {
    id: 'base-forest',
    type: 'tableBase',
    optionId: 'forestBronze',
    name: 'Forest Base',
    price: 620,
    description: 'Dark forest base with bronze accents.'
  },
  {
    id: 'base-midnight',
    type: 'tableBase',
    optionId: 'midnightChrome',
    name: 'Midnight Base',
    price: 650,
    description: 'Midnight chrome base with cool trim.'
  },
  {
    id: 'base-ember',
    type: 'tableBase',
    optionId: 'emberCopper',
    name: 'Ember Base',
    price: 640,
    description: 'Copper-infused base for a warm stage feel.'
  },
  {
    id: 'base-violet',
    type: 'tableBase',
    optionId: 'violetShadow',
    name: 'Violet Shadow Base',
    price: 660,
    description: 'Violet base with dark shadowed trim.'
  },
  {
    id: 'base-desert',
    type: 'tableBase',
    optionId: 'desertGold',
    name: 'Desert Base',
    price: 670,
    description: 'Desert gold base with brushed metal sheen.'
  },
  {
    id: 'chair-midnight',
    type: 'chairColor',
    optionId: 'midnightNavy',
    name: 'Midnight Blue Chairs',
    price: 350,
    description: 'Deep blue upholstery with navy highlights.'
  },
  {
    id: 'chair-emerald',
    type: 'chairColor',
    optionId: 'emeraldWave',
    name: 'Emerald Wave Chairs',
    price: 360,
    description: 'Emerald upholstery with rich contrast piping.'
  },
  {
    id: 'chair-onyx',
    type: 'chairColor',
    optionId: 'onyxShadow',
    name: 'Onyx Shadow Chairs',
    price: 340,
    description: 'Onyx leather-look with graphite legs.'
  },
  {
    id: 'chair-royal',
    type: 'chairColor',
    optionId: 'royalPlum',
    name: 'Royal Chestnut Chairs',
    price: 360,
    description: 'Royal plum upholstery with chestnut accents.'
  },
  {
    id: 'shape-oval',
    type: 'tableShape',
    optionId: 'grandOval',
    name: 'Oval Grand Shape',
    price: 520,
    description: 'Elliptical top profile for a prestige layout.'
  },
  {
    id: 'side-marble',
    type: 'sideColor',
    optionId: 'marble',
    name: 'Marble Side Theme',
    price: 1650,
    description: 'Polished marble-inspired side coloration for pieces.'
  },
  {
    id: 'side-darkForest',
    type: 'sideColor',
    optionId: 'darkForest',
    name: 'Dark Forest Side Theme',
    price: 1725,
    description: 'Dark forest hue pairing with premium finish.'
  },
  {
    id: 'side-royalWave',
    type: 'sideColor',
    optionId: 'royalWave',
    name: 'Royal Wave Side Theme',
    price: 620,
    description: 'Royal blue side coloration for crisp contrast.'
  },
  {
    id: 'side-roseMist',
    type: 'sideColor',
    optionId: 'roseMist',
    name: 'Rose Mist Side Theme',
    price: 640,
    description: 'Rose tinted side coloration with soft sheen.'
  },
  {
    id: 'side-amethyst',
    type: 'sideColor',
    optionId: 'amethyst',
    name: 'Amethyst Side Theme',
    price: 660,
    description: 'Amethyst gradient side coloration for striking contrast.'
  }
];
