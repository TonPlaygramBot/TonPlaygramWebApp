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

  test('Showood keeps the restored rail sight and side apron source geometry/rendering', () => {
    const showood = POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === 'showood-seven-foot'
    );

    assert.ok(showood, 'Showood table model must be configured');
    assert.equal(showood.kind, 'gltf');
    assert.equal(showood.useOriginalLayoutSurfaces, true);
    assert.equal(showood.useReferenceShowoodMapping, true);
    assert.equal(showood.hideGeneratedRailMarkers, true);
    assert.deepEqual(showood.hideSurfaceRoles, []);
    assert.deepEqual(showood.preserveSourceTextureRoles, [
      'railSight',
      'sideWoodApron',
      'baseFoot',
      'trim',
      'pocket'
    ]);
    assert.equal(showood.forceHideExternalReferenceParts, undefined);
    assert.equal(showood.keepGeneratedRailMarkersOnExternal, undefined);
    assert.equal(showood.forceGeneratedChromePlates, false);
    assert.equal(showood.upperFrameHeightScale, 0.58);
    assert.equal(showood.cornerRimHeightScale, 0.28);
    assert.equal(showood.markingVisualLift, 0.024);
    assert.equal(showood.lowerBaseHeightScale, 1.72);
    assert.equal(showood.lowerLegFootReachScale, 1.28);
    assert.equal(showood.footWidthScale, 1.08);
    assert.equal(showood.footHeightScale, 1);
    assert.equal(showood.railSightApronVisualScale, 1.026);
    assert.equal(showood.railSightOutwardOffset, undefined);
    assert.equal(showood.railSightVisualHeightScale, 1.045);
    assert.equal(showood.sideApronVisualHeightScale, 1.07);
    assert.equal(showood.sideApronOutwardOffset, 0.018);
    assert.deepEqual(showood.usePoolRoyaleFinishRoles, ['cloth', 'cushion', 'wood']);
  });

  test('Pool Royale game uses one shared table finish/base menu for Showood', async () => {
    const game = await readFile('webapp/src/pages/Games/PoolRoyale.jsx', 'utf8');

    assert.equal(
      game.includes('Showood Table Setup'),
      false,
      'game should not render a separate Showood setup menu'
    );
    assert.equal(
      game.includes('Shared Table Finish'),
      true,
      'game should label finish options as shared for the table model'
    );
    assert.equal(
      game.includes('Shared Table Base'),
      true,
      'game should label base options as shared for the table model'
    );
    assert.equal(
      game.includes('!showShowoodTableSetup'),
      false,
      'base options should not be hidden for Showood'
    );
  });

  test('Pool Royale uses only the Showood GLB table model', () => {
    assert.deepEqual(
      POOL_ROYALE_TABLE_MODEL_OPTIONS.map((option) => option.id),
      ['showood-seven-foot']
    );
    assert.equal(
      resolvePoolRoyaleTableModel('traditional-fizyman-eight-foot').id,
      'showood-seven-foot'
    );
  });

  test('Pool Royale lobby persists and resolves the selected table model without model cards', async () => {
    const lobby = await readFile(
      'webapp/src/pages/Games/PoolRoyaleLobby.jsx',
      'utf8'
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
      lobby.includes('resolvePoolRoyaleTableModel(stored).id'),
      true,
      'lobby should still resolve stored table model ids safely'
    );
    assert.equal(
      lobby.includes('traditional-fizyman-eight-foot'),
      false,
      'lobby should not reference the removed 8 ft glTF table'
    );
  });
});
