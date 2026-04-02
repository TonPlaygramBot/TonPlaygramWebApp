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
  MURLAN_ROYALE_DEFAULT_UNLOCKS,
  MURLAN_ROYALE_STORE_ITEMS
} from '../webapp/src/config/murlanInventoryConfig.js';
import {
  TEXAS_HOLDEM_DEFAULT_UNLOCKS,
  TEXAS_HOLDEM_STORE_ITEMS,
  TEXAS_TABLE_FINISH_OPTIONS
} from '../webapp/src/config/texasHoldemInventoryConfig.js';
import { TABLE_CLOTH_OPTIONS } from '../webapp/src/utils/tableCustomizationOptions.js';
import { CARD_THEMES } from '../webapp/src/utils/cards3d.js';
import {
  TAVULL_BATTLE_DEFAULT_UNLOCKS,
  TAVULL_BATTLE_CHAIR_OPTIONS,
  TAVULL_BATTLE_BOARD_FINISH_OPTIONS,
  TAVULL_BATTLE_FRAME_FINISH_OPTIONS,
  TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS,
  TAVULL_BATTLE_STORE_ITEMS
} from '../webapp/src/config/tavullBattleInventoryConfig.js';
import { MURLAN_TABLE_FINISHES } from '../webapp/src/config/murlanTableFinishes.js';
import { POOL_ROYALE_HDRI_VARIANTS } from '../webapp/src/config/poolRoyaleInventoryConfig.js';

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

  test('murlan shares texas hold’em inventories for poker arena assets', () => {
    const toOptionSet = (items, type) =>
      new Set(items.filter((item) => item.type === type).map((item) => item.optionId));

    expect(toOptionSet(MURLAN_ROYALE_STORE_ITEMS, 'tables')).toEqual(
      toOptionSet(TEXAS_HOLDEM_STORE_ITEMS, 'tableTheme')
    );
    expect(toOptionSet(MURLAN_ROYALE_STORE_ITEMS, 'stools')).toEqual(
      toOptionSet(TEXAS_HOLDEM_STORE_ITEMS, 'chairTheme')
    );
    expect(toOptionSet(MURLAN_ROYALE_STORE_ITEMS, 'tableFinish')).toEqual(
      new Set(TEXAS_TABLE_FINISH_OPTIONS.map((option) => option.id))
    );
    expect(toOptionSet(MURLAN_ROYALE_STORE_ITEMS, 'tableCloth')).toEqual(
      new Set(TABLE_CLOTH_OPTIONS.map((option) => option.id))
    );
    expect(toOptionSet(MURLAN_ROYALE_STORE_ITEMS, 'cards')).toEqual(
      toOptionSet(TEXAS_HOLDEM_STORE_ITEMS, 'cards')
    );
    expect(MURLAN_ROYALE_DEFAULT_UNLOCKS.tables[0]).toBe(TEXAS_HOLDEM_DEFAULT_UNLOCKS.tableTheme[0]);
    expect(MURLAN_ROYALE_DEFAULT_UNLOCKS.stools[0]).toBe(TEXAS_HOLDEM_DEFAULT_UNLOCKS.chairTheme[0]);
    expect(MURLAN_ROYALE_DEFAULT_UNLOCKS.tableFinish[0]).toBe(TEXAS_HOLDEM_DEFAULT_UNLOCKS.tableFinish[0]);
    expect(MURLAN_ROYALE_DEFAULT_UNLOCKS.tableCloth[0]).toBe(TEXAS_HOLDEM_DEFAULT_UNLOCKS.tableCloth[0]);
    expect(MURLAN_ROYALE_DEFAULT_UNLOCKS.cards[0]).toBe(CARD_THEMES[0]?.id);
  });

  test('tavull store thumbnails match each source option thumbnail', () => {
    const optionByType = {
      tableFinish: new Map(MURLAN_TABLE_FINISHES.map((option) => [option.id, option])),
      tables: new Map(CHESS_TABLE_OPTIONS.map((option) => [option.id, option])),
      chairColor: new Map(TAVULL_BATTLE_CHAIR_OPTIONS.map((option) => [option.id, option])),
      boardFinish: new Map(TAVULL_BATTLE_BOARD_FINISH_OPTIONS.map((option) => [option.id, option])),
      frameFinish: new Map(TAVULL_BATTLE_FRAME_FINISH_OPTIONS.map((option) => [option.id, option])),
      triangleColor: new Map(TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS.map((option) => [option.id, option])),
      environmentHdri: new Map(POOL_ROYALE_HDRI_VARIANTS.map((option) => [option.id, option]))
    };

    TAVULL_BATTLE_STORE_ITEMS.forEach((item) => {
      const source = optionByType[item.type]?.get(item.optionId);
      expect(source).toBeTruthy();
      expect(item.thumbnail).toBe(source.thumbnail);
    });
  });
});
