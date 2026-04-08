import {
  CHESS_BATTLE_ROYAL_DEFAULT_UNLOCKS,
  CHESS_BATTLE_ROYAL_STORE_ITEMS,
  CHESS_BATTLE_TABLE_OPTIONS,
  CHESS_TABLE_FINISH_OPTIONS
} from '../webapp/src/config/chessBattleInventoryConfig.js';

describe('chess battle inventory config', () => {
  test('defaults to octagon table for battle royal', () => {
    expect(CHESS_BATTLE_TABLE_OPTIONS[0]?.id).toBe('murlan-default');
    expect(CHESS_BATTLE_ROYAL_DEFAULT_UNLOCKS.tables[0]).toBe('murlan-default');
  });

  test('store includes octagon, hexagon, and oval table shapes', () => {
    const tableIds = new Set(
      CHESS_BATTLE_ROYAL_STORE_ITEMS.filter((item) => item.type === 'tables').map((item) => item.optionId)
    );
    expect(tableIds.has('murlan-default')).toBe(true);
    expect(tableIds.has('hexagonTable')).toBe(true);
    expect(tableIds.has('grandOval')).toBe(true);
  });

  test('includes LT table finishes in both options and store purchasables', () => {
    const finishIds = new Set(CHESS_TABLE_FINISH_OPTIONS.map((option) => option.id));
    const storeFinishIds = new Set(
      CHESS_BATTLE_ROYAL_STORE_ITEMS.filter((item) => item.type === 'tableFinish').map((item) => item.optionId)
    );

    ['carbonFiberChalk', 'carbonFiberSnakeChalk', 'carbonFiberAlligatorNight'].forEach((id) => {
      expect(finishIds.has(id)).toBe(true);
      expect(storeFinishIds.has(id)).toBe(true);
    });
  });
});
