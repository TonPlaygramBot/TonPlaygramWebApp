import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_POOL_ROYALE_TABLE_MODEL_ID,
  POOL_ROYALE_TABLE_MODEL_OPTIONS,
  resolvePoolRoyaleTableModel
} from '../webapp/src/config/poolRoyaleTableModels.js';

describe('Pool Royale table models', () => {
  test('defaults to the Showood seven-foot GLB table', () => {
    assert.equal(DEFAULT_POOL_ROYALE_TABLE_MODEL_ID, 'showood-seven-foot');
    assert.equal(resolvePoolRoyaleTableModel(null).id, 'showood-seven-foot');
    assert.equal(
      resolvePoolRoyaleTableModel('unknown').id,
      'showood-seven-foot'
    );
  });

  test('Showood uses original GLB surface layout with slightly larger rail sights and apron', () => {
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
    assert.equal(showood.upperFrameHeightScale, 0.58);
    assert.equal(showood.cornerRimHeightScale, 0.28);
    assert.equal(showood.accentBottomTrimOffset, 0);
    assert.equal(showood.originalBaseRemovalCutoffRatio, 0.74);
    assert.equal(showood.markingVisualLift, 0.028);
    assert.equal(showood.lowerBaseHeightScale, 1.72);
    assert.equal(showood.lowerLegFootReachScale, 1.28);
    assert.equal(showood.footWidthScale, 1.08);
    assert.equal(showood.footHeightScale, 1);
    assert.equal(showood.railSightApronVisualScale, 1.066);
    assert.equal(showood.railSightOutwardOffset, 0.034);
    assert.equal(showood.railSightVisualHeightScale, 1.082);
    assert.equal(showood.sideApronVisualHeightScale, 1.11);
    assert.equal(showood.sideApronOutwardOffset, 0.056);
    assert.deepEqual(showood.usePoolRoyaleFinishRoles, ['cloth', 'cushion', 'wood']);
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

  test('Pool Royale shared table base menu excludes removed decorative bases', async () => {
    const inventory = await readFile(
      'webapp/src/config/poolRoyaleInventoryConfig.js',
      'utf8'
    );
    const game = await readFile('webapp/src/pages/Games/PoolRoyale.jsx', 'utf8');

    assert.equal(
      inventory.includes("id: 'gothicCoffeeTable'"),
      false,
      'inventory should not expose the Gothic Coffee Table base'
    );
    assert.equal(
      inventory.includes("id: 'woodenTable02Alt'"),
      false,
      'inventory should not expose the Wooden Table 02 Alt base'
    );
    assert.equal(
      game.includes('gothicCoffeeTable:'),
      false,
      'game should not build the Gothic Coffee Table base'
    );
    assert.equal(
      game.includes('woodenTable02Alt:'),
      false,
      'game should not build the Wooden Table 02 Alt base'
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
