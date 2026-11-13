import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHESS_HUMAN_CHARACTER_OPTIONS,
  CHESS_DEFAULT_HUMAN_CHARACTER_INDEX,
  normalizeChessHumanCharacterSelection
} from '../webapp/src/config/chessBattleInventoryConfig.js';
import {
  MURLAN_CHARACTER_THEMES,
  POOL_ROYALE_CHARACTER_THEMES
} from '../webapp/src/config/murlanCharacterThemes.js';

test('saved retired character selections return to Turi', () => {
  for (const index of [4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17, 18]) {
    const nextIndex = normalizeChessHumanCharacterSelection({ humanCharacter: index });
    assert.equal(CHESS_HUMAN_CHARACTER_OPTIONS[nextIndex].id, 'turi');
  }
});

test('surviving saved characters retain their identity across catalog migration', () => {
  for (const [index, id] of [[10, 'mixamo-xbot'], [11, 'mixamo-soldier'], [19, 'webgl-vietnam-human'], [23, 'webgl-ai-teacher-1']]) {
    const migrated = normalizeChessHumanCharacterSelection({ humanCharacter: index });
    assert.equal(CHESS_HUMAN_CHARACTER_OPTIONS[migrated].id, id);
    assert.equal(normalizeChessHumanCharacterSelection({ humanCharacter: migrated, humanCharacterCatalogVersion: 2 }), migrated);
  }
  for (const humanCharacter of [-10, 99, NaN, Infinity]) {
    assert.equal(normalizeChessHumanCharacterSelection({ humanCharacter, humanCharacterCatalogVersion: 2 }), CHESS_DEFAULT_HUMAN_CHARACTER_INDEX);
  }
});

test('missing Sketchfab packages are absent from the available store roster', () => {
  assert.ok(MURLAN_CHARACTER_THEMES.some(theme => theme.id === 'turi'));
  assert.ok(POOL_ROYALE_CHARACTER_THEMES.some(theme => theme.id === 'turi'));
  assert.ok(POOL_ROYALE_CHARACTER_THEMES.every((theme) => !theme.id.startsWith('sketchfab-')));
});
