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
import { MURLAN_ROYALE_DEFAULT_UNLOCKS, MURLAN_ROYALE_STORE_ITEMS } from '../webapp/src/config/murlanInventoryConfig.js';
import { DOMINO_ROYAL_STORE_ITEMS } from '../webapp/src/config/dominoRoyalInventoryConfig.js';
import {
  TAVULL_BATTLE_DEFAULT_UNLOCKS,
  TAVULL_BATTLE_CHAIR_OPTIONS,
  TAVULL_BATTLE_BOARD_FINISH_OPTIONS,
  TAVULL_BATTLE_FRAME_FINISH_OPTIONS,
  TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS,
  TAVULL_BATTLE_STORE_ITEMS
} from '../webapp/src/config/tavullBattleInventoryConfig.js';
import { MURLAN_TABLE_FINISHES } from '../webapp/src/config/murlanTableFinishes.js';
import { MURLAN_TABLE_CLOTHS } from '../webapp/src/config/murlanTableCloths.js';
import { TABLE_CLOTH_OPTIONS } from '../webapp/src/utils/tableCustomizationOptions.js';
import { CARD_THEMES as TEXAS_CARD_THEMES } from '../webapp/src/utils/cards3d.js';
import { TEXAS_CHAIR_THEME_OPTIONS, TEXAS_TABLE_THEME_OPTIONS } from '../webapp/src/config/texasHoldemOptions.js';
import {
  TEXAS_DEFAULT_HDRI_ID,
  TEXAS_HDRI_OPTIONS,
  TEXAS_TABLE_FINISH_OPTIONS
} from '../webapp/src/config/texasHoldemInventoryConfig.js';
import { POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS } from '../webapp/src/config/poolRoyaleInventoryConfig.js';

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

  test('texas holdem reuses pool hdris and domino chair catalog while keeping separate store ids', () => {
    expect(TEXAS_HDRI_OPTIONS).toBe(POOL_ROYALE_HDRI_VARIANTS);
    expect(TEXAS_DEFAULT_HDRI_ID).toBe(POOL_ROYALE_DEFAULT_HDRI_ID);
    expect(TEXAS_CHAIR_THEME_OPTIONS).toBe(DOMINO_ROYAL_OPTION_SETS.chairTheme);
  });


  test('murlan royale reuses pool hdris and texas inventory catalogs while keeping separate store entries', () => {
    const toOptionSet = (items, type) =>
      new Set(items.filter((item) => item.type === type).map((item) => item.optionId));

    expect(new Set(MURLAN_ROYALE_DEFAULT_UNLOCKS.environmentHdri)).toEqual(
      new Set(POOL_ROYALE_HDRI_VARIANTS.map((variant) => variant.id))
    );
    expect(new Set(MURLAN_ROYALE_DEFAULT_UNLOCKS.tables)).toEqual(
      new Set([TEXAS_TABLE_THEME_OPTIONS[0]?.id])
    );
    expect(new Set(MURLAN_ROYALE_DEFAULT_UNLOCKS.stools)).toEqual(
      new Set([TEXAS_CHAIR_THEME_OPTIONS[0]?.id])
    );
    expect(new Set(MURLAN_ROYALE_DEFAULT_UNLOCKS.tableFinish)).toEqual(
      new Set([TEXAS_TABLE_FINISH_OPTIONS[0]?.id])
    );
    expect(new Set(MURLAN_ROYALE_DEFAULT_UNLOCKS.tableCloth)).toEqual(
      new Set([TABLE_CLOTH_OPTIONS[0]?.id])
    );
    expect(new Set(MURLAN_ROYALE_DEFAULT_UNLOCKS.cards)).toEqual(
      new Set([TEXAS_CARD_THEMES[0]?.id])
    );

    expect(new Set(MURLAN_TABLE_FINISHES.map((option) => option.id))).toEqual(
      new Set(TEXAS_TABLE_FINISH_OPTIONS.map((option) => option.id))
    );
    expect(new Set(MURLAN_TABLE_CLOTHS.map((option) => option.id))).toEqual(
      new Set(TABLE_CLOTH_OPTIONS.map((option) => option.id))
    );

    expect(toOptionSet(MURLAN_ROYALE_STORE_ITEMS, 'environmentHdri')).toEqual(
      new Set(POOL_ROYALE_HDRI_VARIANTS.map((variant) => variant.id))
    );
    expect(toOptionSet(MURLAN_ROYALE_STORE_ITEMS, 'tables')).toEqual(
      new Set(TEXAS_TABLE_THEME_OPTIONS.slice(1).map((option) => option.id))
    );
    expect(toOptionSet(MURLAN_ROYALE_STORE_ITEMS, 'stools')).toEqual(
      new Set(TEXAS_CHAIR_THEME_OPTIONS.slice(1).map((option) => option.id))
    );
    expect(toOptionSet(MURLAN_ROYALE_STORE_ITEMS, 'tableFinish')).toEqual(
      new Set(TEXAS_TABLE_FINISH_OPTIONS.map((option) => option.id))
    );
    expect(toOptionSet(MURLAN_ROYALE_STORE_ITEMS, 'tableCloth')).toEqual(
      new Set(TABLE_CLOTH_OPTIONS.map((option) => option.id))
    );
    expect(toOptionSet(MURLAN_ROYALE_STORE_ITEMS, 'cards')).toEqual(
      new Set(TEXAS_CARD_THEMES.slice(1).map((option) => option.id))
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
