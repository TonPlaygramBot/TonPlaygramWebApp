import {
  CHESS_BATTLE_DEFAULT_UNLOCKS,
  CHESS_BATTLE_STORE_ITEMS
} from '../webapp/src/config/chessBattleInventoryConfig.js';

describe('Chess Battle Royal table inventory', () => {
  test('includes oval, diamond edge, and hexagon tables in store purchasables', () => {
    const tableIds = new Set(
      CHESS_BATTLE_STORE_ITEMS.filter((item) => item.type === 'tables').map((item) => item.optionId)
    );
    expect(tableIds.has('ovalTable')).toBe(true);
    expect(tableIds.has('diamondEdge')).toBe(true);
    expect(tableIds.has('hexagonTable')).toBe(true);
  });

  test('keeps table cloth and base defaults unlocked', () => {
    expect(Array.isArray(CHESS_BATTLE_DEFAULT_UNLOCKS.tableCloth)).toBe(true);
    expect(Array.isArray(CHESS_BATTLE_DEFAULT_UNLOCKS.tableBase)).toBe(true);
    expect(CHESS_BATTLE_DEFAULT_UNLOCKS.tableCloth.length).toBeGreaterThan(0);
    expect(CHESS_BATTLE_DEFAULT_UNLOCKS.tableBase.length).toBeGreaterThan(0);
  });
});
