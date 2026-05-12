import assert from 'node:assert/strict';
import {
  DEFAULT_POOL_ROYALE_TABLE_MODEL_ID,
  POOL_ROYALE_TABLE_MODEL_OPTIONS,
  resolvePoolRoyaleTableModel
} from '../webapp/src/config/poolRoyaleTableModels.js';

describe('Pool Royale table models', () => {
  test('defaults to the Showood GLB table', () => {
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
    assert.equal(showood.assetUrl, '/assets/models/pool-royale/showood/seven_foot_showood.glb');
    assert.match(showood.fallbackAssetUrl, /seven_foot_showood\/seven_foot_showood\.glb$/);
    assert.equal(showood.useOriginalLayoutSurfaces, true);
    assert.equal(showood.fitScale, 1);
    assert.equal(showood.clothRepeatScale, 7.5);
    assert.deepEqual(showood.hideSurfaceRoles, []);
    assert.deepEqual(showood.preserveOriginalSurfaceRoles, []);
    assert.equal(showood.tintOriginalTrimGold, false);
    assert.equal(showood.lowerBaseHeightScale, 0.68);
    assert.equal(showood.legLengthScale, 0.84);
    assert.equal(showood.baseFootWidthScale, 1.68);
    assert.deepEqual(showood.chromeMaterialSurfaceNames, [
      'diamonds',
      'railSight',
      'sideWoodApron',
      'apron'
    ]);
    assert.deepEqual(showood.blackMaterialSurfaceNames, []);
    assert.deepEqual(showood.clothMaterialSurfaceNames, [
      'pocketCutoutEdge',
      'pocketCut',
      'pocketMouth',
      'pocketNotch'
    ]);
    assert.equal(showood.forceGeneratedChromePlates, false);
    assert.deepEqual(showood.usePoolRoyaleFinishRoles, [
      'cloth',
      'cushion',
      'wood',
      'pocket',
      'trim'
    ]);
    assert.equal('playfieldVisualLift' in showood, false);
    assert.equal(showood.fitHeightScale, 1);
  });
});
