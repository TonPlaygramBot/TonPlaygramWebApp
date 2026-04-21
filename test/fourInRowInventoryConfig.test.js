import {
  FOUR_IN_ROW_BATTLE_DEFAULT_UNLOCKS,
  FOUR_IN_ROW_BATTLE_OPTION_LABELS,
  FOUR_IN_ROW_BATTLE_STORE_ITEMS,
  FOUR_IN_ROW_TABLE_CLOTH_OPTIONS,
  FOUR_IN_ROW_TABLE_FINISH_OPTIONS
} from '../webapp/src/config/fourInRowInventoryConfig.js';

describe('fourInRowInventoryConfig', () => {
  test('includes LT table finishes in selectable options', () => {
    const finishIds = new Set(FOUR_IN_ROW_TABLE_FINISH_OPTIONS.map((option) => option.id));
    expect(finishIds.has('carbonFiberChalk')).toBe(true);
    expect(finishIds.has('carbonFiberAlligatorNight')).toBe(true);
  });

  test('adds polyhaven cloth options to defaults and labels', () => {
    const defaultCloth = FOUR_IN_ROW_BATTLE_DEFAULT_UNLOCKS.tableCloth?.[0];
    expect(defaultCloth).toBe(FOUR_IN_ROW_TABLE_CLOTH_OPTIONS[0]?.id);
    expect(FOUR_IN_ROW_BATTLE_OPTION_LABELS.tableCloth?.[defaultCloth]).toBeTruthy();
  });

  test('store includes table cloth and LT finish purchasables', () => {
    const storeByType = FOUR_IN_ROW_BATTLE_STORE_ITEMS.reduce((acc, item) => {
      if (!acc[item.type]) acc[item.type] = [];
      acc[item.type].push(item.optionId);
      return acc;
    }, {});

    expect(storeByType.tableCloth?.length).toBeGreaterThan(0);
    expect(storeByType.tableFinish).toContain('carbonFiberChalk');
  });
});
