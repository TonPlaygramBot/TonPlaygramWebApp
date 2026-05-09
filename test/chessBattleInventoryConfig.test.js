import {
  CHESS_BATTLE_DEFAULT_UNLOCKS,
  CHESS_BATTLE_ROYAL_DEFAULT_UNLOCKS,
  CHESS_HUMAN_CHARACTER_OPTIONS,
  CHESS_BATTLE_ROYAL_STORE_ITEMS,
  CHESS_BATTLE_TABLE_OPTIONS,
  CHESS_TABLE_FINISH_OPTIONS
} from '../webapp/src/config/chessBattleInventoryConfig.js';
import { CAPTURE_ANIMATION_OPTIONS } from '../webapp/src/config/ludoBattleOptions.js';

describe('chess battle inventory config', () => {
  test('defaults to Coffee Table 01 for battle royal', () => {
    expect(CHESS_BATTLE_TABLE_OPTIONS[0]?.id).toBe('CoffeeTable_01');
    expect(CHESS_BATTLE_ROYAL_DEFAULT_UNLOCKS.tables[0]).toBe('CoffeeTable_01');
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

    ['carbonFiberChalk', 'carbonFiberChalkDarkGreen', 'carbonFiberAlligatorNight'].forEach((id) => {
      expect(finishIds.has(id)).toBe(true);
      expect(storeFinishIds.has(id)).toBe(true);
    });
  });


  test('sells every Ludo capture animation weapon for Chess Battle Royal', () => {
    const storeCaptureIds = new Set(
      CHESS_BATTLE_ROYAL_STORE_ITEMS.filter((item) => item.type === 'captureAnimation').map((item) => item.optionId)
    );
    const purchasableLudoCaptureIds = CAPTURE_ANIMATION_OPTIONS.slice(1).map((option) => option.id);

    purchasableLudoCaptureIds.forEach((id) => {
      expect(storeCaptureIds.has(id)).toBe(true);
    });
  });

  test('keeps current avatar free by default and sells exactly the 5 requested WebGL humans', () => {
    expect(CHESS_HUMAN_CHARACTER_OPTIONS[0]?.id).toBe('rpm-current');
    expect(CHESS_BATTLE_DEFAULT_UNLOCKS.humanCharacter[0]).toBe('rpm-current');
    expect(CHESS_BATTLE_ROYAL_DEFAULT_UNLOCKS.humanCharacter[0]).toBe('rpm-current');

    const storeHumanIds = CHESS_BATTLE_ROYAL_STORE_ITEMS
      .filter((item) => item.type === 'humanCharacter')
      .map((item) => item.optionId)
      .sort();

    expect(storeHumanIds).toEqual(
      [
        'webgl-ai-teacher',
        'webgl-ai-teacher-1',
        'webgl-human-body-a',
        'webgl-human-body-b',
        'webgl-vietnam-human'
      ].sort()
    );
  });
});
