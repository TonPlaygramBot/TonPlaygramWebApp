import {
  CHESS_BATTLE_DEFAULT_UNLOCKS,
  CHESS_TABLE_OPTIONS
} from '../webapp/src/config/chessBattleInventoryConfig.js';
import {
  DOMINO_ROYAL_DEFAULT_UNLOCKS,
  DOMINO_ROYAL_OPTION_SETS
} from '../webapp/src/config/dominoRoyalInventoryConfig.js';
import {
  LUDO_BATTLE_STORE_ITEMS
} from '../webapp/src/config/ludoBattleInventoryConfig.js';
import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from '../webapp/src/config/murlanThemes.js';

describe('cross-game inventory alignment', () => {
  test('domino default table follows chess default murlan table', () => {
    expect(CHESS_BATTLE_DEFAULT_UNLOCKS.tables[0]).toBe(CHESS_TABLE_OPTIONS[0]?.id);
    expect(DOMINO_ROYAL_DEFAULT_UNLOCKS.tableTheme[0]).toBe(CHESS_BATTLE_DEFAULT_UNLOCKS.tables[0]);
    expect(DOMINO_ROYAL_DEFAULT_UNLOCKS.tableTheme[0]).toBe(DOMINO_ROYAL_OPTION_SETS.tableTheme[0]?.id);
  });

  test('ludo store contains every murlan table and chair theme', () => {
    const tableIds = new Set(
      LUDO_BATTLE_STORE_ITEMS.filter((item) => item.type === 'tables').map((item) => item.optionId)
    );
    const stoolIds = new Set(
      LUDO_BATTLE_STORE_ITEMS.filter((item) => item.type === 'stools').map((item) => item.optionId)
    );

    expect(tableIds).toEqual(new Set(MURLAN_TABLE_THEMES.map((theme) => theme.id)));
    expect(stoolIds).toEqual(new Set(MURLAN_STOOL_THEMES.map((theme) => theme.id)));
  });
});
