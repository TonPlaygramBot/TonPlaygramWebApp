import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_POOL_ROYALE_TABLE_MODEL_ID,
  POOL_ROYALE_TABLE_MODEL_OPTIONS,
  resolvePoolRoyaleTableModel
} from '../webapp/src/config/poolRoyaleTableModels.js';

describe('Pool Royale table models', () => {
  test('defaults to the Royal Original GLB-overlay table', () => {
    assert.equal(DEFAULT_POOL_ROYALE_TABLE_MODEL_ID, 'royal-original');
    assert.equal(resolvePoolRoyaleTableModel(null).id, 'royal-original');
    assert.equal(resolvePoolRoyaleTableModel('unknown').id, 'royal-original');
  });

  test('Royal Original hides generated cushions and jaws in favor of GLB surfaces', () => {
    const royal = POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === 'royal-original'
    );

    assert.ok(royal, 'Royal Original table model must be configured');
    assert.equal(royal.kind, 'gltf');
    assert.equal(royal.keepGeneratedShell, true);
    assert.deepEqual(royal.hideSurfaceRoles, ['trim', 'wood']);
    assert.deepEqual(royal.usePoolRoyaleFinishRoles, ['cloth', 'cushion', 'pocket']);
    assert.deepEqual(royal.preserveSourceTextureRoles, []);
    assert.equal(royal.matchCushionsToCloth, true);
    assert.equal(royal.forceGeneratedChromePlates, true);
  });

  test('Showood uses the supplied reference material mapping and menu controls', () => {
    const showood = POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === 'showood-seven-foot'
    );

    assert.ok(showood, 'Showood table model must be configured');
    assert.equal(showood.kind, 'gltf');
    assert.equal(showood.useOriginalLayoutSurfaces, true);
    assert.equal(showood.materialMapping, 'showoodReference');
    assert.equal(showood.usePoolRoyaleFinish, false);
    assert.deepEqual(showood.usePoolRoyaleFinishRoles, [
      'cloth',
      'cushion',
      'wood',
      'pocket',
      'trim'
    ]);
    assert.deepEqual(showood.preserveOriginalSurfaceRoles, []);
    assert.deepEqual(showood.hideSurfaceRoles, []);
    assert.equal(showood.tintOriginalTrimGold, false);
    assert.equal(showood.forceGeneratedChromePlates, false);
    assert.ok(showood.assetUrl.endsWith('seven_foot_showood.glb'));
    assert.ok(showood.fallbackAssetUrl.endsWith('seven_foot_showood_pbr.glb'));
  });

  test('Pool Royale lobby keeps both Royal Original and Showood table choices', async () => {
    const lobby = await readFile(
      'webapp/src/pages/Games/PoolRoyaleLobby.jsx',
      'utf8'
    );

    assert.deepEqual(
      POOL_ROYALE_TABLE_MODEL_OPTIONS.map((option) => option.id),
      ['royal-original', 'showood-seven-foot']
    );
    assert.ok(
      lobby.includes('POOL_ROYALE_TABLE_MODEL_OPTIONS.map'),
      'lobby should render table model option cards'
    );
    assert.ok(
      lobby.includes('setTableModelId'),
      'lobby should allow switching between table models'
    );
  });
});
