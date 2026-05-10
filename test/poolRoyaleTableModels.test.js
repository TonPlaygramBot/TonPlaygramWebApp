import assert from 'node:assert/strict';
import {
  DEFAULT_POOL_ROYALE_TABLE_MODEL_ID,
  POOL_ROYALE_TABLE_MODEL_OPTIONS,
  resolvePoolRoyaleTableModel
} from '../webapp/src/config/poolRoyaleTableModels.js';

describe('Pool Royale table models', () => {
  test('defaults to the Showood GLB table', () => {
    assert.equal(DEFAULT_POOL_ROYALE_TABLE_MODEL_ID, 'showood-seven-foot');
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
    assert.equal(showood.fitScale, 1.02);
    assert.equal(showood.clothRepeatScale, 5.25);
    assert.deepEqual(showood.hideSurfaceRoles, []);
    assert.deepEqual(showood.preserveOriginalSurfaceRoles, ['trim']);
    assert.equal(showood.tintOriginalTrimGold, true);
    assert.equal(showood.forceGeneratedChromePlates, false);
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
