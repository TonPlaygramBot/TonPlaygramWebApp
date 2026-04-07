import {
  CHESS_BATTLE_DEFAULT_UNLOCKS,
  CHESS_BATTLE_STORE_ITEMS
} from '../webapp/src/config/chessBattleInventoryConfig.js';
import { TABLE_CLOTH_OPTIONS } from '../webapp/src/utils/tableCustomizationOptions.js';

describe('chess battle inventory config', () => {
  test('includes procedural table models in purchasables', () => {
    const purchasableTableIds = new Set(
      CHESS_BATTLE_STORE_ITEMS.filter((item) => item.type === 'tables').map((item) => item.optionId)
    );
    expect(purchasableTableIds.has('ovalTable')).toBe(true);
    expect(purchasableTableIds.has('diamondEdge')).toBe(true);
    expect(purchasableTableIds.has('hexagonTable')).toBe(true);
  });

  test('includes table cloth unlocks and defaults to first cloth option', () => {
    const clothIds = new Set(
      CHESS_BATTLE_STORE_ITEMS.filter((item) => item.type === 'tableCloth').map((item) => item.optionId)
    );
    TABLE_CLOTH_OPTIONS.slice(1).forEach((option) => {
      expect(clothIds.has(option.id)).toBe(true);
    });
    expect(CHESS_BATTLE_DEFAULT_UNLOCKS.tableCloth[0]).toBe(TABLE_CLOTH_OPTIONS[0]?.id);
  });
});
