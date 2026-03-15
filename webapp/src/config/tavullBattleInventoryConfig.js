import {
  CHESS_BATTLE_DEFAULT_LOADOUT,
  CHESS_BATTLE_DEFAULT_UNLOCKS,
  CHESS_BATTLE_OPTION_LABELS,
  CHESS_BATTLE_STORE_ITEMS
} from './chessBattleInventoryConfig.js';
import { SNAKE_OPTION_LABELS, SNAKE_STORE_ITEMS } from './snakeInventoryConfig.js';

const DICE_ITEMS = SNAKE_STORE_ITEMS.filter((item) => item.type === 'diceTheme').map((item) => ({
  ...item,
  id: `tavull-${item.id}`
}));

const DEFAULT_DICE_ID = DICE_ITEMS[0]?.optionId;

export const TAVULL_BATTLE_DEFAULT_UNLOCKS = Object.freeze({
  ...CHESS_BATTLE_DEFAULT_UNLOCKS,
  diceTheme: DEFAULT_DICE_ID ? [DEFAULT_DICE_ID] : []
});

export const TAVULL_BATTLE_OPTION_LABELS = Object.freeze({
  ...CHESS_BATTLE_OPTION_LABELS,
  diceTheme: Object.freeze(SNAKE_OPTION_LABELS.diceTheme || {})
});

export const TAVULL_BATTLE_STORE_ITEMS = [
  ...CHESS_BATTLE_STORE_ITEMS,
  ...DICE_ITEMS
];

export const TAVULL_BATTLE_DEFAULT_LOADOUT = [
  ...CHESS_BATTLE_DEFAULT_LOADOUT,
  ...(DEFAULT_DICE_ID
    ? [
        {
          type: 'diceTheme',
          optionId: DEFAULT_DICE_ID,
          label: TAVULL_BATTLE_OPTION_LABELS.diceTheme?.[DEFAULT_DICE_ID] || 'Dice Finish'
        }
      ]
    : [])
];
