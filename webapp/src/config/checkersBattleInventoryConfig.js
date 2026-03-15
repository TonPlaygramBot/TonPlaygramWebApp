import {
  CHESS_BATTLE_DEFAULT_LOADOUT,
  CHESS_BATTLE_DEFAULT_UNLOCKS,
  CHESS_BATTLE_OPTION_THUMBNAILS,
  CHESS_BATTLE_STORE_ITEMS,
  CHESS_TABLE_OPTIONS,
  CHESS_CHAIR_OPTIONS,
  CHESS_BATTLE_OPTION_LABELS
} from './chessBattleInventoryConfig.js';

const CHECKERS_SIDE_LABELS = {
  marble: 'Ivory Chip Set',
  darkForest: 'Forest Chip Set',
  amberGlow: 'Amber Chip Set',
  mintVale: 'Mint Chip Set',
  royalWave: 'Royal Chip Set',
  roseMist: 'Rose Chip Set',
  amethyst: 'Amethyst Chip Set',
  cinderBlaze: 'Cinder Chip Set',
  arcticDrift: 'Arctic Chip Set'
};

const remapStoreItem = (item) => {
  if (item.type !== 'sideColor') return { ...item };
  const label = CHECKERS_SIDE_LABELS[item.optionId] || item.name;
  return {
    ...item,
    id: item.id.replace('chess-side', 'checkers-chip'),
    name: label,
    description: `Chip-style checker palette: ${label}.`
  };
};

export const CHECKERS_TABLE_OPTIONS = CHESS_TABLE_OPTIONS;
export const CHECKERS_CHAIR_OPTIONS = CHESS_CHAIR_OPTIONS;

export const CHECKERS_BATTLE_DEFAULT_UNLOCKS = {
  ...CHESS_BATTLE_DEFAULT_UNLOCKS
};

export const CHECKERS_BATTLE_OPTION_LABELS = {
  ...CHESS_BATTLE_OPTION_LABELS,
  sideColor: CHECKERS_SIDE_LABELS
};

export const CHECKERS_BATTLE_OPTION_THUMBNAILS = CHESS_BATTLE_OPTION_THUMBNAILS;

export const CHECKERS_BATTLE_STORE_ITEMS = CHESS_BATTLE_STORE_ITEMS.map(remapStoreItem);

export const CHECKERS_BATTLE_DEFAULT_LOADOUT = [...CHESS_BATTLE_DEFAULT_LOADOUT];
