import {
  CHESS_BATTLE_DEFAULT_UNLOCKS,
  CHESS_BATTLE_STORE_ITEMS
} from '../webapp/src/config/chessBattleInventoryConfig.js';

describe('Chess Battle Royal table customization inventory', () => {
  test('includes texas-style premium table shapes in store purchasables', () => {
    const storeShapeIds = new Set(
      CHESS_BATTLE_STORE_ITEMS.filter((item) => item.type === 'tableShape').map((item) => item.optionId)
    );
    expect(storeShapeIds.has('diamondEdge')).toBe(true);
    expect(storeShapeIds.has('grandOval')).toBe(true);
    expect(storeShapeIds.has('hexagonTable')).toBe(true);
  });

  test('default unlocks include octagon table shape and default cloth/base', () => {
    expect(CHESS_BATTLE_DEFAULT_UNLOCKS.tableShape?.[0]).toBe('classicOctagon');
    expect(CHESS_BATTLE_DEFAULT_UNLOCKS.tableCloth?.length).toBeGreaterThan(0);
    expect(CHESS_BATTLE_DEFAULT_UNLOCKS.tableBase?.length).toBeGreaterThan(0);
  });
});
