import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_POOL_ROYALE_TABLE_MODEL_ID,
  POOL_ROYALE_TABLE_MODEL_OPTIONS,
  resolvePoolRoyaleTableModel
} from '../webapp/src/config/poolRoyaleTableModels.js';

describe('Pool Royale table models', () => {
  test('defaults to the Showood GLB table', () => {
    assert.equal(DEFAULT_POOL_ROYALE_TABLE_MODEL_ID, 'showood-seven-foot');
    assert.equal(resolvePoolRoyaleTableModel(null).id, 'showood-seven-foot');
    assert.equal(
      resolvePoolRoyaleTableModel('unknown').id,
      'showood-seven-foot'
    );
  });

  test('Showood uses original GLB surface layout with Pool Royale finish textures', () => {
    const showood = POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === 'showood-seven-foot'
    );

    assert.ok(showood, 'Showood table model must be configured');
    assert.equal(showood.kind, 'gltf');
    assert.equal(showood.useOriginalLayoutSurfaces, true);
    assert.equal(
      showood.assetUrl,
      '/models/pool-royale/showood-seven-foot/seven_foot_showood.glb'
    );
    assert.ok(
      showood.fallbackAssetUrls.every((url) =>
        url.endsWith('seven_foot_showood.glb')
      )
    );
    assert.equal(showood.fitScale, 1);
    assert.equal(showood.fitFootprintScale, 1);
    assert.equal(showood.preserveOriginalFootprintAspect, false);
    assert.equal(showood.lowerBaseHeightScale, 1.38);
    assert.equal(showood.legLengthScale, 2.05);
    assert.equal(showood.clothRepeatScale, 7.5);
    assert.deepEqual(showood.hideSurfaceRoles, []);
    assert.deepEqual(showood.preserveOriginalSurfaceRoles, []);
    assert.equal(showood.tintOriginalTrimGold, true);
    assert.deepEqual(showood.chromeMaterialSurfaceNames, [
      'diamonds',
      'railSight',
      'sideApron',
      'apronStrip',
      'railSightLower',
      'cornerRailSight'
    ]);
    assert.deepEqual(showood.blackMaterialSurfaceNames, []);
    assert.equal(showood.forceGeneratedChromePlates, false);
    assert.deepEqual(showood.usePoolRoyaleFinishRoles, [
      'cloth',
      'cushion',
      'wood',
      'pocket',
      'trim'
    ]);
    assert.equal('playfieldVisualLift' in showood, false);
    assert.equal(showood.fitReference, 'showoodGameplaySurfaces');
    assert.equal(showood.fitHeightScale, 1);
  });

  test('Only Showood 7 ft GLB table remains selectable', () => {
    assert.deepEqual(
      POOL_ROYALE_TABLE_MODEL_OPTIONS.map((option) => option.id),
      ['showood-seven-foot']
    );
    assert.equal(
      resolvePoolRoyaleTableModel('traditional-fizyman-eight-foot').id,
      'showood-seven-foot'
    );
  });

  test('Pool Royale lobby uses the fixed Showood table without model choices', async () => {
    const lobby = await readFile(
      'webapp/src/pages/Games/PoolRoyaleLobby.jsx',
      'utf8'
    );

    assert.ok(
      lobby.includes('Showood 7 ft GLB is now the fixed Pool Royale table.'),
      'lobby should explain the fixed Showood table'
    );
    assert.equal(
      lobby.includes('POOL_ROYALE_TABLE_MODEL_OPTIONS.map'),
      false,
      'lobby should not render table model option cards'
    );
    assert.equal(
      lobby.includes('setTableModelId'),
      false,
      'lobby should not allow switching table models'
    );
    assert.equal(
      lobby.includes('traditional-fizyman-eight-foot'),
      false,
      'lobby should not reference the removed 8 ft glTF table'
    );
  });
});
