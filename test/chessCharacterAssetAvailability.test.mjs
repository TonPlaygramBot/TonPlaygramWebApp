import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHESS_HUMAN_CHARACTER_OPTIONS,
  normalizeChessHumanCharacterSelection
} from '../webapp/src/config/chessBattleInventoryConfig.js';
import {
  MURLAN_CHARACTER_THEMES,
  POOL_ROYALE_CHARACTER_THEMES
} from '../webapp/src/config/murlanCharacterThemes.js';

test('saved retired character selections return to Current Avatar', () => {
  for (const index of [4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17, 18]) {
    const nextIndex = normalizeChessHumanCharacterSelection({ humanCharacter: index });
    assert.equal(CHESS_HUMAN_CHARACTER_OPTIONS[nextIndex].id, 'rpm-current');
  }
});

test('surviving saved characters retain their identity across catalog migration', () => {
  for (const [index, id] of [[10, 'mixamo-xbot'], [11, 'mixamo-soldier'], [19, 'webgl-vietnam-human'], [23, 'webgl-ai-teacher-1']]) {
    const migrated = normalizeChessHumanCharacterSelection({ humanCharacter: index });
    assert.equal(CHESS_HUMAN_CHARACTER_OPTIONS[migrated].id, id);
    assert.equal(normalizeChessHumanCharacterSelection({ humanCharacter: migrated, humanCharacterCatalogVersion: 2 }), migrated);
  }
  for (const humanCharacter of [-10, 99, NaN, Infinity]) {
    assert.equal(normalizeChessHumanCharacterSelection({ humanCharacter, humanCharacterCatalogVersion: 2 }), 0);
  }
});

test('missing Sketchfab packages are absent from the available store roster', () => {
  assert.equal(MURLAN_CHARACTER_THEMES.length, 7);
  assert.equal(POOL_ROYALE_CHARACTER_THEMES.length, 9);
  assert.ok(POOL_ROYALE_CHARACTER_THEMES.every((theme) => !theme.id.startsWith('sketchfab-')));
});
