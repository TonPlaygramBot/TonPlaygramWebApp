import {
  CHESS_BATTLE_DEFAULT_UNLOCKS,
  CHESS_BATTLE_STORE_ITEMS,
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
import { DOMINO_ROYAL_STORE_ITEMS } from '../webapp/src/config/dominoRoyalInventoryConfig.js';
import {
  TAVULL_BATTLE_DEFAULT_UNLOCKS,
  TAVULL_BATTLE_STORE_ITEMS
} from '../webapp/src/config/tavullBattleInventoryConfig.js';

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

  test('domino store and defaults contain every murlan table and chair theme', () => {
    const tableStoreIds = new Set(
      DOMINO_ROYAL_STORE_ITEMS.filter((item) => item.type === 'tableTheme').map((item) => item.optionId)
    );
    const chairStoreIds = new Set(
      DOMINO_ROYAL_STORE_ITEMS.filter((item) => item.type === 'chairTheme').map((item) => item.optionId)
    );

    expect(tableStoreIds).toEqual(new Set(MURLAN_TABLE_THEMES.map((theme) => theme.id)));
    expect(chairStoreIds).toEqual(new Set(MURLAN_STOOL_THEMES.map((theme) => theme.id)));
    expect(new Set(DOMINO_ROYAL_DEFAULT_UNLOCKS.tableTheme)).toEqual(
      new Set(MURLAN_TABLE_THEMES.map((theme) => theme.id))
    );
    expect(new Set(DOMINO_ROYAL_DEFAULT_UNLOCKS.chairTheme)).toEqual(
      new Set(MURLAN_STOOL_THEMES.map((theme) => theme.id))
    );
  });

  test('tavull store keeps chess arena items for tables, chairs, cloth, and hdri', () => {
    const toOptionSet = (items, type) =>
      new Set(items.filter((item) => item.type === type).map((item) => item.optionId));
    const chessTables = toOptionSet(CHESS_BATTLE_STORE_ITEMS, 'tables');
    const chessChairs = toOptionSet(CHESS_BATTLE_STORE_ITEMS, 'chairColor');
    const chessTableFinish = toOptionSet(CHESS_BATTLE_STORE_ITEMS, 'tableFinish');
    const chessHdri = toOptionSet(CHESS_BATTLE_STORE_ITEMS, 'environmentHdri');

    expect(toOptionSet(TAVULL_BATTLE_STORE_ITEMS, 'tables')).toEqual(chessTables);
    expect(toOptionSet(TAVULL_BATTLE_STORE_ITEMS, 'chairColor')).toEqual(chessChairs);
    expect(toOptionSet(TAVULL_BATTLE_STORE_ITEMS, 'tableFinish')).toEqual(chessTableFinish);
    expect(toOptionSet(TAVULL_BATTLE_STORE_ITEMS, 'environmentHdri')).toEqual(chessHdri);
    expect(TAVULL_BATTLE_DEFAULT_UNLOCKS.tables[0]).toBe(CHESS_BATTLE_DEFAULT_UNLOCKS.tables[0]);
  });
});
