import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_POOL_ROYALE_TABLE_MODEL_ID,
  POOL_ROYALE_TABLE_MODEL_OPTIONS,
  resolvePoolRoyaleTableModel
} from '../webapp/src/config/poolRoyaleTableModels.js';
import { resolveTableSize } from '../webapp/src/config/poolRoyaleTables.js';
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

  test('Showood preserves source GLB layout, size proportions, and materials', () => {
    const showood = POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === 'showood-seven-foot'
    );

    assert.ok(showood, 'Showood table model must be configured');
    assert.equal(showood.kind, 'gltf');
    assert.equal(showood.useOriginalLayoutSurfaces, true);
    assert.equal(showood.useReferenceShowoodMapping, true);
    assert.equal(showood.hideGeneratedRailMarkers, false);
    assert.deepEqual(showood.hideSurfaceRoles, []);
    assert.equal(showood.tableSizeId, '7ft');
    assert.deepEqual(resolveTableSize(showood.tableSizeId).playfield, { widthMm: 1981.2, heightMm: 990.6 });
    assert.equal(showood.fitScale, 1);
    assert.equal(showood.fitStrategy, 'contain');
    assert.equal(showood.preserveSourceLayout, true);
    assert.equal(showood.preserveSourceMaterials, true);
    assert.equal(showood.useProceduralBaseWithExternal, false);
    assert.equal(showood.hideOriginalBaseAndLegsForProceduralBase, false);
    assert.equal(showood.keepGeneratedPocketDropHardware, false);
    assert.equal(showood.keepGeneratedBrandPlates, false);
    assert.equal(showood.keepGeneratedRailMarkersOnExternal, false);
    assert.deepEqual(showood.forceHideExternalReferenceParts, []);
    assert.equal(showood.forceGeneratedChromePlates, false);
    assert.deepEqual(showood.preserveSourceTextureRoles, [
      'cloth',
      'cushion',
      'wood',
      'sideWoodApron',
      'baseFoot',
      'trim',
      'pocket'
    ]);
    assert.deepEqual(showood.preserveOriginalSurfaceRoles, [
      'cloth',
      'cushion',
      'wood',
      'trim',
      'pocket'
    ]);
    assert.equal(showood.markingVisualLift, 0.028);
    assert.deepEqual(showood.usePoolRoyaleFinishRoles, []);
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
      ['showood-seven-foot']
    );
    assert.equal(
      resolvePoolRoyaleTableModel('traditional-fizyman-eight-foot').id,
      'showood-seven-foot'
    );
  });

  test('Pool Royale lobby exposes model choices without removed 8 ft guidance', async () => {
    const lobby = await readFile(
      'webapp/src/pages/Games/PoolRoyaleLobby.jsx',
      'utf8'
    );

    assert.equal(
      lobby.includes('traditional-fizyman-eight-foot'),
      false,
      'lobby should not reference the removed 8 ft glTF table'
    );
  });
});
