import {
  CHESS_BATTLE_DEFAULT_UNLOCKS,
  CHESS_CHAIR_OPTIONS,
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
import { MURLAN_TABLE_FINISHES } from '../webapp/src/config/murlanTableFinishes.js';
import {
  POOL_ROYALE_HDRI_VARIANTS
} from '../webapp/src/config/poolRoyaleInventoryConfig.js';
import {
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

  test('tavull store mirrors chess core arena catalog for tables/chairs/cloth/hdri', () => {
    const tavullTableIds = new Set(
      TAVULL_BATTLE_STORE_ITEMS.filter((item) => item.type === 'tables').map((item) => item.optionId)
    );
    const tavullChairIds = new Set(
      TAVULL_BATTLE_STORE_ITEMS.filter((item) => item.type === 'chairColor').map((item) => item.optionId)
    );
    const tavullFinishIds = new Set(
      TAVULL_BATTLE_STORE_ITEMS.filter((item) => item.type === 'tableFinish').map((item) => item.optionId)
    );
    const tavullHdriIds = new Set(
      TAVULL_BATTLE_STORE_ITEMS.filter((item) => item.type === 'environmentHdri').map((item) => item.optionId)
    );

    expect(tavullTableIds).toEqual(new Set(CHESS_TABLE_OPTIONS.slice(1).map((item) => item.id)));
    expect(tavullChairIds).toEqual(new Set(CHESS_CHAIR_OPTIONS.slice(1).map((item) => item.id)));
    expect(tavullFinishIds).toEqual(new Set(MURLAN_TABLE_FINISHES.map((item) => item.id)));
    expect(tavullHdriIds).toEqual(new Set(POOL_ROYALE_HDRI_VARIANTS.slice(1).map((item) => item.id)));
  });
});
