import assert from 'node:assert/strict';
import {
  DEFAULT_POOL_ROYALE_TABLE_MODEL_ID,
  POOL_ROYALE_TABLE_MODEL_OPTIONS,
  resolvePoolRoyaleTableModel
} from '../webapp/src/config/poolRoyaleTableModels.js';

describe('Pool Royale table models', () => {
  test('defaults to the native Royal Original table', () => {
    assert.equal(DEFAULT_POOL_ROYALE_TABLE_MODEL_ID, 'royal-original');
    assert.equal(resolvePoolRoyaleTableModel(null).id, 'royal-original');
    assert.equal(resolvePoolRoyaleTableModel('unknown').id, 'royal-original');
  });

  test('Showood uses original GLB surface layout with Pool Royale finish textures', () => {
    const showood = POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === 'showood-seven-foot'
    );

    assert.ok(showood, 'Showood table model must be configured');
    assert.equal(showood.kind, 'gltf');
    assert.equal(showood.useOriginalLayoutSurfaces, true);
    assert.equal(showood.fitScale, 1.08);
    assert.equal(showood.clothRepeatScale, 8.5);
    assert.deepEqual(showood.hideSurfaceRoles, []);
    assert.deepEqual(showood.preserveOriginalSurfaceRoles, ['trim']);
    assert.equal(showood.forceGeneratedChromePlates, false);
    assert.equal(showood.keepGeneratedPocketHolders, true);
    assert.deepEqual(showood.verticalProfile, {
      upperRailBottomTrimRatio: 0.18,
      baseHeightBoostRatio: 0.16,
      baseSplitRatio: 0.42
    });
    assert.deepEqual(showood.usePoolRoyaleFinishRoles, [
      'cloth',
      'cushion',
      'wood',
      'pocket'
    ]);
    assert.equal('playfieldVisualLift' in showood, false);
    assert.equal('fitHeightScale' in showood, false);
  });
});
