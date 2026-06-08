import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_POOL_ROYALE_TABLE_MODEL_ID,
  POOL_ROYALE_TABLE_MODEL_OPTIONS,
  resolvePoolRoyaleTableModel
} from '../webapp/src/config/poolRoyaleTableModels.js';
import {
  POOL_ROYALE_DEFAULT_LOADOUT,
  POOL_ROYALE_DEFAULT_UNLOCKS,
  POOL_ROYALE_OPTION_LABELS,
  POOL_ROYALE_STORE_ITEMS
} from '../webapp/src/config/poolRoyaleInventoryConfig.js';

describe('Pool Royale table models', () => {
  test('defaults to the Showood seven-foot GLB table', () => {
    assert.equal(DEFAULT_POOL_ROYALE_TABLE_MODEL_ID, 'showood-seven-foot');
    assert.equal(resolvePoolRoyaleTableModel(null).id, 'showood-seven-foot');
    assert.equal(
      resolvePoolRoyaleTableModel('unknown').id,
      'showood-seven-foot'
    );
  });

  test('Showood uses original GLB surface layout with a slightly larger fit scale', () => {
    const showood = POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === 'showood-seven-foot'
    );

    assert.ok(showood, 'Showood table model must be configured');
    assert.equal(showood.kind, 'gltf');
    assert.equal(showood.useOriginalLayoutSurfaces, true);
    assert.equal(showood.useReferenceShowoodMapping, true);
    assert.equal(showood.hideGeneratedRailMarkers, false);
    assert.deepEqual(showood.hideSurfaceRoles, []);
    assert.deepEqual(showood.preserveSourceTextureRoles, [
      'sideWoodApron',
      'baseFoot',
      'trim',
      'pocket'
    ]);
    assert.equal(showood.forceGeneratedChromePlates, false);
    assert.equal(showood.fitScale, 1.04);
    assert.equal(showood.upperFrameHeightScale, 1);
    assert.equal(showood.cornerRimHeightScale, 1);
    assert.equal(showood.accentBottomTrimOffset, 0);
    assert.equal(showood.markingVisualLift, 0.028);
    assert.equal(showood.lowerBaseHeightScale, 1);
    assert.equal(showood.lowerLegFootReachScale, 1);
    assert.equal(showood.footWidthScale, 1);
    assert.equal(showood.footHeightScale, 1);
    assert.equal(showood.railSightApronVisualScale, 1);
    assert.equal(showood.railSightOutwardOffset, 0);
    assert.equal(showood.railSightVisualHeightScale, 1);
    assert.equal(showood.sideApronVisualHeightScale, 1);
    assert.equal(showood.sideApronOutwardOffset, 0);
    assert.deepEqual(showood.usePoolRoyaleFinishRoles, ['cloth', 'cushion', 'wood']);
  });


  test('Showood procedural chrome plate style is removed from Pool Royale inventory', () => {
    assert.deepEqual(POOL_ROYALE_DEFAULT_UNLOCKS.chromePlateStyle, [
      'showood-rounded',
      'royal-classic'
    ]);
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        POOL_ROYALE_OPTION_LABELS.chromePlateStyle,
        'showood-procedural'
      ),
      false
    );
    assert.equal(
      POOL_ROYALE_STORE_ITEMS.some((item) => item.optionId === 'showood-procedural'),
      false
    );
    assert.equal(
      POOL_ROYALE_DEFAULT_LOADOUT.some((item) => item.optionId === 'showood-procedural'),
      false
    );
  });

  test('Pool Royale game uses one shared table finish/base menu for Royal and Showood', async () => {
    const game = await readFile('webapp/src/pages/Games/PoolRoyale.jsx', 'utf8');

    assert.equal(
      game.includes('Showood Table Setup'),
      false,
      'game should not render a separate Showood setup menu'
    );
    assert.equal(
      game.includes('Shared Table Finish'),
      true,
      'game should label finish options as shared between table models'
    );
    assert.equal(
      game.includes('Shared Table Base'),
      true,
      'game should label base options as shared between table models'
    );
    assert.equal(
      game.includes('!showShowoodTableSetup'),
      false,
      'base options should not be hidden when Showood is selected'
    );
  });

  test('Showood table remains selectable', () => {
    assert.deepEqual(
      POOL_ROYALE_TABLE_MODEL_OPTIONS.map((option) => option.id),
      ['showood-seven-foot', 'traditional-fizyman-eight-foot']
    );
    assert.equal(
      resolvePoolRoyaleTableModel('traditional-fizyman-eight-foot').id,
      'traditional-fizyman-eight-foot'
    );
  });

  test('Traditional fizyman table uses the 8 ft table-only runtime GLB', () => {
    const traditional = POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === 'traditional-fizyman-eight-foot'
    );

    assert.ok(traditional, 'Traditional table model must be configured');
    assert.equal(traditional.kind, 'gltf');
    assert.equal(traditional.tableSizeId, '8ft');
    assert.equal(traditional.useOriginalLayoutSurfaces, true);
    assert.equal(traditional.usePoolRoyaleFinish, false);
    assert.equal(traditional.hideGeneratedRailMarkers, true);
    assert.equal(
      traditional.assetUrl,
      '/models/pool-royale/traditional-fizyman-eight-foot/pool_table_traditional.glb'
    );
  });

  test('Pool Royale lobby exposes table model choices', async () => {
    const lobby = await readFile(
      'webapp/src/pages/Games/PoolRoyaleLobby.jsx',
      'utf8'
    );

    assert.equal(lobby.includes('Choose Table'), true);
    assert.equal(lobby.includes('POOL_ROYALE_TABLE_MODEL_OPTIONS'), true);
    assert.equal(lobby.includes('selectTableModel'), true);
  });
});
