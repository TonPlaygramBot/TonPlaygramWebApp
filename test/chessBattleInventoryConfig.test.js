import {
  CHESS_BATTLE_DEFAULT_UNLOCKS,
  CHESS_BATTLE_ROYAL_DEFAULT_UNLOCKS,
  CHESS_HUMAN_CHARACTER_OPTIONS,
  CHESS_BATTLE_WEAPON_IDS,
  CHESS_BATTLE_WEAPON_OPTIONS,
  CHESS_BATTLE_OPTION_LABELS,
  CHESS_BATTLE_ROYAL_STORE_ITEMS,
  CHESS_BATTLE_TABLE_OPTIONS,
  CHESS_TABLE_FINISH_OPTIONS
} from '../webapp/src/config/chessBattleInventoryConfig.js';
import { CAPTURE_ANIMATION_OPTIONS } from '../webapp/src/config/ludoBattleOptions.js';
import { readFile } from 'node:fs/promises';

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

  test('offers exactly the four requested Chess Battle Royal weapons', () => {
    const labelsById = Object.fromEntries(CAPTURE_ANIMATION_OPTIONS.map((option) => [option.id, option.label]));
    expect(labelsById.droneAttack).toBe('Shahad Drone');
    expect(labelsById.ukrainianDroneAttack).toBe('Ukrainian Drone');
    expect(CHESS_BATTLE_OPTION_LABELS.captureAnimation.ukrainianDroneAttack).toBe('Ukrainian Drone');
    expect(CHESS_BATTLE_DEFAULT_UNLOCKS.captureAnimation).toContain('ukrainianDroneAttack');
    expect(CHESS_BATTLE_ROYAL_DEFAULT_UNLOCKS.captureAnimation).toContain('ukrainianDroneAttack');

    expect(CHESS_BATTLE_WEAPON_IDS).toEqual([
      'droneAttack',
      'ukrainianDroneAttack',
      'fpsGunAttack',
      'missileJavelin'
    ]);
    expect(CHESS_BATTLE_WEAPON_OPTIONS.map((option) => option.id)).toEqual(CHESS_BATTLE_WEAPON_IDS);
    expect(CHESS_BATTLE_DEFAULT_UNLOCKS.captureAnimation).toEqual(CHESS_BATTLE_WEAPON_IDS);

    const storeDroneIds = new Set(
      CHESS_BATTLE_ROYAL_STORE_ITEMS.filter((item) => item.type === 'captureAnimation').map((item) => item.optionId)
    );
    expect(storeDroneIds.has('droneAttack')).toBe(true);
    expect(storeDroneIds.has('ukrainianDroneAttack')).toBe(true);
    expect(
      CHESS_BATTLE_ROYAL_STORE_ITEMS
        .filter((item) => item.type === 'captureAnimation')
        .every((item) => CHESS_BATTLE_WEAPON_IDS.includes(item.optionId))
    ).toBe(true);
  });

  test('keeps the short missile and both inventory drones on dedicated low flight lanes', async () => {
    const source = await readFile('webapp/src/pages/Games/ChessBattleRoyal.jsx', 'utf8');

    expect(source).toContain(
      'const CAPTURE_SHAHAD_DRONE_STRIKE_ALTITUDE = CAPTURE_DRONE_REFERENCE_BOARD_ALTITUDE * 2.15;'
    );
    expect(source).toContain(
      'const CAPTURE_UKRAINIAN_DRONE_CRUISE_HEIGHT = CAPTURE_DRONE_REFERENCE_BOARD_ALTITUDE * 2.25;'
    );
    expect(source).toContain(
      'const CAPTURE_SHORT_MISSILE_STRIKE_ALTITUDE = CAPTURE_DRONE_REFERENCE_BOARD_ALTITUDE * 1.55;'
    );
    expect(source).toContain('strikeAltitude: CAPTURE_SHORT_MISSILE_STRIKE_ALTITUDE');
    expect(source).toContain('strikeAltitude: CAPTURE_SHAHAD_DRONE_STRIKE_ALTITUDE');
    expect(source).toContain('cruiseHeight: CAPTURE_UKRAINIAN_DRONE_CRUISE_HEIGHT');
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
