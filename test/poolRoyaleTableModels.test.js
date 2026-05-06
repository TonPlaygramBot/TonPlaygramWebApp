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
    assert.deepEqual(showood.hideSurfaceRoles, []);
    assert.deepEqual(showood.preserveOriginalSurfaceRoles, ['trim']);
    assert.deepEqual(showood.usePoolRoyaleFinishRoles, [
      'cloth',
      'cushion',
      'wood',
      'pocket'
    ]);
    assert.equal(showood.matchNativeHeight, true);
    assert.equal(showood.matchNativeUpperComponentHeight, false);
    assert.equal(showood.matchProceduralClothTextureScale, true);
    assert.equal(showood.useModelPhysicsMapping, true);
    assert.equal(showood.physicsMapping.source, 'showood-visual-profile');
    assert.equal(showood.physicsMapping.fallback, 'pool-royale-procedural');
    assert.equal(showood.physicsMapping.cushionSegmentSource, 'generated-showood-jaws');
    assert.equal(showood.physicsMapping.jawMappingRadiusScale, 1);
    assert.equal(showood.physicsMapping.railCutInsetScale, 1);
    assert.equal('playfieldVisualLift' in showood, false);
    assert.equal('fitHeightScale' in showood, false);
  });
});
