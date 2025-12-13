import {
  TABLE_WOOD_OPTIONS,
  TABLE_CLOTH_OPTIONS,
  TABLE_BASE_OPTIONS,
  DEFAULT_TABLE_CUSTOMIZATION
} from '../utils/tableCustomizationOptions.js';
import { TABLE_SHAPE_OPTIONS } from '../utils/murlanTable.js';

const AVAILABLE_TABLE_SHAPES = TABLE_SHAPE_OPTIONS.filter((shape) => shape.id !== 'diamondEdge');

export const CHESS_SIDE_COLOR_OPTIONS = Object.freeze([
  { id: 'marble', hex: 0xffffff, label: 'Marble' },
  { id: 'darkForest', hex: 0x0b3b29, label: 'Dark Forest' },
  { id: 'amberGlow', hex: 0xf59e0b, label: 'Amber Glow' },
  { id: 'mintVale', hex: 0x10b981, label: 'Mint Vale' },
  { id: 'royalWave', hex: 0x3b82f6, label: 'Royal Wave' },
  { id: 'roseMist', hex: 0xef4444, label: 'Rose Mist' },
  { id: 'amethyst', hex: 0x8b5cf6, label: 'Amethyst' }
]);

export const CHESS_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: [TABLE_WOOD_OPTIONS[0]?.id],
  tableCloth: [TABLE_CLOTH_OPTIONS[0]?.id],
  tableBase: [TABLE_BASE_OPTIONS[0]?.id],
  chairColor: ['crimsonVelvet'],
  tableShape: [AVAILABLE_TABLE_SHAPES[0]?.id],
  sideColor: ['amberGlow', 'mintVale']
});

export const CHESS_OPTION_LABELS = Object.freeze({
  tableWood: TABLE_WOOD_OPTIONS.reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {}),
  tableCloth: TABLE_CLOTH_OPTIONS.reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {}),
  tableBase: TABLE_BASE_OPTIONS.reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {}),
  chairColor: Object.freeze({
    crimsonVelvet: 'Crimson Velvet',
    midnightNavy: 'Midnight Blue',
    emeraldWave: 'Emerald Wave',
    onyxShadow: 'Onyx Shadow',
    royalPlum: 'Royal Chestnut'
  }),
  tableShape: AVAILABLE_TABLE_SHAPES.reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {}),
  sideColor: CHESS_SIDE_COLOR_OPTIONS.reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {})
});

export const CHESS_STORE_ITEMS = [
  // Table wood (beyond the first free option)
  {
    id: 'chess-wood-warmBrown',
    type: 'tableWood',
    optionId: 'warmBrown',
    name: 'Warm Brown Wood',
    price: 820,
    description: 'Rich walnut-inspired planks with deep grain and warmth.'
  },
  {
    id: 'chess-wood-cleanStrips',
    type: 'tableWood',
    optionId: 'cleanStrips',
    name: 'Clean Strip Wood',
    price: 860,
    description: 'Studio-style oak strips with crisp seams and satin finish.'
  },
  {
    id: 'chess-wood-oldFloor',
    type: 'tableWood',
    optionId: 'oldWoodFloor',
    name: 'Heritage Floor Wood',
    price: 940,
    description: 'Weathered floorboards with smoked oak character.'
  },
  // Cloth colors
  {
    id: 'chess-cloth-emerald',
    type: 'tableCloth',
    optionId: 'emerald',
    name: 'Emerald Cloth',
    price: 620,
    description: 'Tournament emerald felt with deep shading.'
  },
  {
    id: 'chess-cloth-arctic',
    type: 'tableCloth',
    optionId: 'arctic',
    name: 'Arctic Cloth',
    price: 640,
    description: 'Cool arctic blue felt with vibrant contrast.'
  },
  {
    id: 'chess-cloth-sunset',
    type: 'tableCloth',
    optionId: 'sunset',
    name: 'Sunset Cloth',
    price: 660,
    description: 'Amber sunset felt for a dramatic arena glow.'
  },
  {
    id: 'chess-cloth-violet',
    type: 'tableCloth',
    optionId: 'violet',
    name: 'Violet Cloth',
    price: 660,
    description: 'Royal violet felt with soft sheen.'
  },
  {
    id: 'chess-cloth-amber',
    type: 'tableCloth',
    optionId: 'amber',
    name: 'Amber Cloth',
    price: 640,
    description: 'Amber-inspired felt with warm undertones.'
  },
  // Base finishes
  {
    id: 'chess-base-forestBronze',
    type: 'tableBase',
    optionId: 'forestBronze',
    name: 'Forest Bronze Base',
    price: 710,
    description: 'Dark bronze base with forest undertones.'
  },
  {
    id: 'chess-base-midnightChrome',
    type: 'tableBase',
    optionId: 'midnightChrome',
    name: 'Midnight Chrome Base',
    price: 760,
    description: 'Deep navy base with chrome trim accents.'
  },
  {
    id: 'chess-base-emberCopper',
    type: 'tableBase',
    optionId: 'emberCopper',
    name: 'Ember Copper Base',
    price: 760,
    description: 'Copper-trimmed base with ember shimmer.'
  },
  {
    id: 'chess-base-violetShadow',
    type: 'tableBase',
    optionId: 'violetShadow',
    name: 'Violet Shadow Base',
    price: 780,
    description: 'Violet shadow base with rich metalness.'
  },
  {
    id: 'chess-base-desertGold',
    type: 'tableBase',
    optionId: 'desertGold',
    name: 'Desert Gold Base',
    price: 800,
    description: 'Sandy gold base with bold contrast trim.'
  },
  // Chair colors
  {
    id: 'chess-chair-midnight',
    type: 'chairColor',
    optionId: 'midnightNavy',
    name: 'Midnight Chairs',
    price: 520,
    description: 'Midnight blue upholstery with brushed accents.'
  },
  {
    id: 'chess-chair-emerald',
    type: 'chairColor',
    optionId: 'emeraldWave',
    name: 'Emerald Chairs',
    price: 540,
    description: 'Emerald upholstery with deep forest tones.'
  },
  {
    id: 'chess-chair-onyx',
    type: 'chairColor',
    optionId: 'onyxShadow',
    name: 'Onyx Chairs',
    price: 560,
    description: 'Onyx shadow chairs with graphite legs.'
  },
  {
    id: 'chess-chair-royalPlum',
    type: 'chairColor',
    optionId: 'royalPlum',
    name: 'Royal Chestnut Chairs',
    price: 560,
    description: 'Royal plum upholstery with chestnut warmth.'
  },
  // Table shapes
  {
    id: 'chess-shape-grandOval',
    type: 'tableShape',
    optionId: 'grandOval',
    name: 'Grand Oval Table',
    price: 760,
    description: 'Sleek oval chess table silhouette.'
  },
  // Side colors (premium for marble + dark forest)
  {
    id: 'chess-side-marble',
    type: 'sideColor',
    optionId: 'marble',
    name: 'Marble Side Color',
    price: 1800,
    description: 'Premium marble-inspired polish for your pieces.'
  },
  {
    id: 'chess-side-darkForest',
    type: 'sideColor',
    optionId: 'darkForest',
    name: 'Dark Forest Side Color',
    price: 1750,
    description: 'Deep forest tone with luxurious lacquer.'
  },
  {
    id: 'chess-side-royalWave',
    type: 'sideColor',
    optionId: 'royalWave',
    name: 'Royal Wave Side Color',
    price: 640,
    description: 'Royal blue wave tint for your chess set.'
  },
  {
    id: 'chess-side-roseMist',
    type: 'sideColor',
    optionId: 'roseMist',
    name: 'Rose Mist Side Color',
    price: 640,
    description: 'Soft rose hue with gentle highlights.'
  },
  {
    id: 'chess-side-amethyst',
    type: 'sideColor',
    optionId: 'amethyst',
    name: 'Amethyst Side Color',
    price: 680,
    description: 'Amethyst tint with crystalline sheen.'
  }
];

export const CHESS_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: TABLE_WOOD_OPTIONS[0]?.id, label: 'Light Natural Wood' },
  { type: 'tableCloth', optionId: TABLE_CLOTH_OPTIONS[0]?.id, label: 'Crimson Cloth' },
  { type: 'tableBase', optionId: TABLE_BASE_OPTIONS[0]?.id, label: 'Obsidian Base' },
  { type: 'chairColor', optionId: 'crimsonVelvet', label: 'Crimson Velvet Chairs' },
  {
    type: 'tableShape',
    optionId: AVAILABLE_TABLE_SHAPES[0]?.id,
    label: AVAILABLE_TABLE_SHAPES[0]?.label || 'Tournament Table'
  },
  { type: 'sideColor', optionId: 'amberGlow', label: 'Amber Glow Side Color' },
  { type: 'sideColor', optionId: 'mintVale', label: 'Mint Vale Side Color' }
];

export const CHESS_DEFAULT_LOADOUT_IDS = Object.freeze(
  CHESS_DEFAULT_LOADOUT.map((entry) => entry.optionId)
);

export const CHESS_DEFAULT_CUSTOMIZATION = Object.freeze({
  ...DEFAULT_TABLE_CUSTOMIZATION,
  chairColor: 0,
  tableShape: 0
});
