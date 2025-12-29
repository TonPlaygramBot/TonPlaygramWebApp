import {
  TABLE_WOOD_OPTIONS,
  TABLE_CLOTH_OPTIONS,
  TABLE_BASE_OPTIONS
} from '../utils/tableCustomizationOptions.js';
import { TABLE_SHAPE_OPTIONS } from '../utils/murlanTable.js';

const DEFAULT_TABLE_SHAPE_ID = TABLE_SHAPE_OPTIONS.find((opt) => opt.id !== 'diamondEdge')?.id;

export const CHESS_BATTLE_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: [TABLE_WOOD_OPTIONS[0]?.id],
  tableCloth: [TABLE_CLOTH_OPTIONS[0]?.id],
  tableBase: [TABLE_BASE_OPTIONS[0]?.id],
  chairColor: ['crimsonVelvet'],
  tableShape: [DEFAULT_TABLE_SHAPE_ID],
  sideColor: ['amberGlow', 'mintVale'],
  boardTheme: ['classic'],
  headStyle: ['current']
});

export const CHESS_BATTLE_OPTION_LABELS = Object.freeze({
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
  chairColor: Object.freeze({
    crimsonVelvet: 'Crimson Velvet',
    midnightNavy: 'Midnight Blue',
    emeraldWave: 'Emerald Wave',
    onyxShadow: 'Onyx Shadow',
    royalPlum: 'Royal Chestnut'
  }),
  tableShape: Object.freeze(
    TABLE_SHAPE_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  sideColor: Object.freeze({
    marble: 'Marble',
    darkForest: 'Dark Forest',
    amberGlow: 'Amber Glow',
    mintVale: 'Mint Vale',
    royalWave: 'Royal Wave',
    roseMist: 'Rose Mist',
    amethyst: 'Amethyst',
    cinderBlaze: 'Cinder Blaze',
    arcticDrift: 'Arctic Drift'
  }),
  boardTheme: Object.freeze({
    classic: 'Classic',
    ivorySlate: 'Ivory/Slate',
    forest: 'Forest',
    sand: 'Sand/Brown',
    ocean: 'Ocean',
    violet: 'Violet',
    chrome: 'Chrome',
    nebulaGlass: 'Nebula Glass'
  }),
  headStyle: Object.freeze({
    current: 'Current',
    headRuby: 'Ruby',
    headSapphire: 'Sapphire',
    headChrome: 'Chrome',
    headGold: 'Gold'
  })
});

export const CHESS_BATTLE_STORE_ITEMS = [
  ...TABLE_WOOD_OPTIONS.slice(1).map((option, idx) => ({
    id: `chess-wood-${option.id}`,
    type: 'tableWood',
    optionId: option.id,
    name: option.label,
    price: 520 + idx * 40,
    description: 'Unlock an alternate table wood finish for Chess Battle Royal.'
  })),
  ...TABLE_CLOTH_OPTIONS.slice(1).map((option, idx) => ({
    id: `chess-cloth-${option.id}`,
    type: 'tableCloth',
    optionId: option.id,
    name: option.label,
    price: 360 + idx * 30,
    description: 'Swap in a new premium cloth hue for your chess arena.'
  })),
  ...TABLE_BASE_OPTIONS.slice(1).map((option, idx) => ({
    id: `chess-base-${option.id}`,
    type: 'tableBase',
    optionId: option.id,
    name: option.label,
    price: 410 + idx * 35,
    description: 'Upgrade the pedestal finish beneath your chess board.'
  })),
  { id: 'chess-chair-midnight', type: 'chairColor', optionId: 'midnightNavy', name: 'Midnight Blue Chairs', price: 320, description: 'Deep navy lounge chairs for the battle table.' },
  { id: 'chess-chair-emerald', type: 'chairColor', optionId: 'emeraldWave', name: 'Emerald Wave Chairs', price: 340, description: 'Emerald upholstery with rich contrast piping.' },
  { id: 'chess-chair-onyx', type: 'chairColor', optionId: 'onyxShadow', name: 'Onyx Shadow Chairs', price: 380, description: 'Shadow-black seating with steel-toned trim.' },
  { id: 'chess-chair-plum', type: 'chairColor', optionId: 'royalPlum', name: 'Royal Chestnut Chairs', price: 360, description: 'Chestnut-plum accent chairs for regal matches.' },
  { id: 'chess-shape-oval', type: 'tableShape', optionId: 'grandOval', name: 'Grand Oval Shape', price: 640, description: 'Smooth oval table outline for the chess board.' },
  { id: 'chess-side-marble', type: 'sideColor', optionId: 'marble', name: 'Marble Pieces', price: 1400, description: 'Premium marble-inspired pieces for either side.' },
  { id: 'chess-side-forest', type: 'sideColor', optionId: 'darkForest', name: 'Dark Forest Pieces', price: 1300, description: 'Deep forest hue pieces with luxe accents.' },
  { id: 'chess-side-royal', type: 'sideColor', optionId: 'royalWave', name: 'Royal Wave Pieces', price: 420, description: 'Royal blue quick-select palette.' },
  { id: 'chess-side-rose', type: 'sideColor', optionId: 'roseMist', name: 'Rose Mist Pieces', price: 420, description: 'Rosy quick-select palette with soft glow.' },
  { id: 'chess-side-amethyst', type: 'sideColor', optionId: 'amethyst', name: 'Amethyst Pieces', price: 460, description: 'Amethyst quick-select palette with sheen.' },
  { id: 'chess-side-cinder', type: 'sideColor', optionId: 'cinderBlaze', name: 'Cinder Blaze Pieces', price: 480, description: 'Molten orange-on-charcoal palette for fiery showdowns.' },
  { id: 'chess-side-arctic', type: 'sideColor', optionId: 'arcticDrift', name: 'Arctic Drift Pieces', price: 520, description: 'Icy stone palette with frosted metallic hints.' },
  { id: 'chess-board-ivorySlate', type: 'boardTheme', optionId: 'ivorySlate', name: 'Ivory/Slate Board', price: 380, description: 'Alternate board palette for fast swaps.' },
  { id: 'chess-board-forest', type: 'boardTheme', optionId: 'forest', name: 'Forest Board', price: 410, description: 'Alternate board palette for fast swaps.' },
  { id: 'chess-board-sand', type: 'boardTheme', optionId: 'sand', name: 'Sand/Brown Board', price: 440, description: 'Alternate board palette for fast swaps.' },
  { id: 'chess-board-ocean', type: 'boardTheme', optionId: 'ocean', name: 'Ocean Board', price: 470, description: 'Alternate board palette for fast swaps.' },
  { id: 'chess-board-violet', type: 'boardTheme', optionId: 'violet', name: 'Violet Board', price: 500, description: 'Alternate board palette for fast swaps.' },
  { id: 'chess-board-chrome', type: 'boardTheme', optionId: 'chrome', name: 'Chrome Board', price: 540, description: 'Alternate board palette for fast swaps.' },
  { id: 'chess-board-nebula', type: 'boardTheme', optionId: 'nebulaGlass', name: 'Nebula Glass Board', price: 580, description: 'Cosmic glass palette with deep-space contrasts.' },
  { id: 'chess-head-ruby', type: 'headStyle', optionId: 'headRuby', name: 'Ruby Pawn Heads', price: 310, description: 'Unlocks an additional pawn head glass preset.' },
  { id: 'chess-head-sapphire', type: 'headStyle', optionId: 'headSapphire', name: 'Sapphire Pawn Heads', price: 335, description: 'Unlocks an additional pawn head glass preset.' },
  { id: 'chess-head-chrome', type: 'headStyle', optionId: 'headChrome', name: 'Chrome Pawn Heads', price: 360, description: 'Unlocks an additional pawn head glass preset.' },
  { id: 'chess-head-gold', type: 'headStyle', optionId: 'headGold', name: 'Gold Pawn Heads', price: 385, description: 'Unlocks an additional pawn head glass preset.' }
];

export const CHESS_BATTLE_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: TABLE_WOOD_OPTIONS[0]?.id, label: TABLE_WOOD_OPTIONS[0]?.label },
  { type: 'tableCloth', optionId: TABLE_CLOTH_OPTIONS[0]?.id, label: TABLE_CLOTH_OPTIONS[0]?.label },
  { type: 'tableBase', optionId: TABLE_BASE_OPTIONS[0]?.id, label: TABLE_BASE_OPTIONS[0]?.label },
  { type: 'chairColor', optionId: 'crimsonVelvet', label: 'Crimson Velvet Chairs' },
  { type: 'tableShape', optionId: DEFAULT_TABLE_SHAPE_ID, label: CHESS_BATTLE_OPTION_LABELS.tableShape[DEFAULT_TABLE_SHAPE_ID] },
  { type: 'sideColor', optionId: 'amberGlow', label: 'Amber Glow Pieces' },
  { type: 'sideColor', optionId: 'mintVale', label: 'Mint Vale Pieces' },
  { type: 'boardTheme', optionId: 'classic', label: 'Classic Board' },
  { type: 'headStyle', optionId: 'current', label: 'Current Pawn Heads' }
];
