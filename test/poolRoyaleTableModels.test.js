import assert from 'node:assert/strict';
import {
  DEFAULT_POOL_ROYALE_TABLE_MODEL_ID,
  POOL_ROYALE_TABLE_MODEL_OPTIONS,
  resolvePoolRoyaleTableModel
} from '../webapp/src/config/poolRoyaleTableModels.js';

describe('Pool Royale table models', () => {
  test('defaults to the Showood table model', () => {
    assert.equal(DEFAULT_POOL_ROYALE_TABLE_MODEL_ID, 'showood-seven-foot');
    assert.equal(resolvePoolRoyaleTableModel(null).id, 'showood-seven-foot');
    assert.equal(resolvePoolRoyaleTableModel('unknown').id, 'showood-seven-foot');
  });

  test('Showood uses original GLB surface layout with Pool Royale finish textures', () => {
    const showood = POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === 'showood-seven-foot'
    );

    assert.ok(showood, 'Showood table model must be configured');
    assert.equal(showood.kind, 'gltf');
    assert.equal(showood.useOriginalLayoutSurfaces, true);
    assert.equal(showood.fitScale, 1.08);
    assert.equal(showood.clothRepeatScale, 5.25);
    assert.deepEqual(showood.hideSurfaceRoles, ['trim']);
    assert.deepEqual(showood.preserveOriginalSurfaceRoles, ['pocket']);
    assert.equal(showood.forceGeneratedChromePlates, true);
    assert.deepEqual(showood.usePoolRoyaleFinishRoles, [
      'cloth',
      'cushion',
      'wood'
    ]);
    assert.equal('playfieldVisualLift' in showood, false);
    assert.equal('fitHeightScale' in showood, false);
  });
});
