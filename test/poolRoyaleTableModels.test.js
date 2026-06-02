import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_POOL_ROYALE_TABLE_MODEL_ID,
  POOL_ROYALE_TABLE_MODEL_OPTIONS,
  resolvePoolRoyaleTableModel
} from '../webapp/src/config/poolRoyaleTableModels.js';

describe('Pool Royale table models', () => {
  test('defaults to the Royal Original procedural table', () => {
    assert.equal(DEFAULT_POOL_ROYALE_TABLE_MODEL_ID, 'royal-original');
    assert.equal(resolvePoolRoyaleTableModel(null).id, 'royal-original');
    assert.equal(
      resolvePoolRoyaleTableModel('unknown').id,
      'royal-original'
    );
  });

  test('Royal Original keeps procedural pockets, jaws, and chrome over the Showood cloth', () => {
    const royal = POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === 'royal-original'
    );

    assert.ok(royal, 'Royal Original table model must be configured');
    assert.equal(royal.kind, 'gltf');
    assert.equal(royal.useOriginalLayoutSurfaces, false);
    assert.equal(royal.keepGeneratedShell, true);
    assert.equal(royal.keepGeneratedPocketsAndJaws, true);
    assert.equal(royal.hideGeneratedPocketsAndJaws, false);
    assert.equal(royal.forceGeneratedChromePlates, true);
    assert.equal(royal.fitScale, 1.055);
    assert.equal(royal.railWidthScale, 1.08);
    assert.equal(royal.chromePlateWidthMatchRailScale, 1.08);
    assert.equal(royal.pocketJawShowoodAlignmentScale, 1.018);
    assert.deepEqual(royal.usePoolRoyaleFinishRoles, ['cloth']);
    assert.deepEqual(royal.hideSurfaceRoles, ['trim', 'wood', 'cushion', 'pocket']);
  });

  test('Showood keeps the GLB layout while replacing rail diamonds with procedural markers', () => {
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
    assert.deepEqual(showood.hideExternalReferenceParts, ['railDiamondMarking']);
    assert.equal(showood.keepGeneratedBrandPlatesOnExternal, true);
    assert.equal(showood.railMarkerLayout, 'showood-source');
    assert.equal(showood.railMarkerLongRailOutwardScale, 1.12);
    assert.equal(showood.railMarkerShortRailOutwardScale, 1.1);
    assert.equal(showood.railMarkerSizeScale, 0.92);
    assert.equal(showood.proceduralPocketCutoutScale, 1.012);
    assert.equal(showood.forceGeneratedChromePlates, false);
    assert.equal(showood.upperFrameHeightScale, 0.58);
    assert.equal(showood.cornerRimHeightScale, 0.28);
    assert.equal(showood.markingVisualLift, 0.024);
    assert.equal(showood.lowerBaseHeightScale, 1.72);
    assert.equal(showood.lowerLegFootReachScale, 1.28);
    assert.equal(showood.footWidthScale, 1.08);
    assert.equal(showood.footHeightScale, 1);
    assert.equal(showood.railSightApronVisualScale, 1.035);
    assert.equal(showood.railSightVisualHeightScale, 1.055);
    assert.equal(showood.sideApronVisualHeightScale, 1.085);
    assert.equal(showood.sideApronOutwardOffset, 0.022);
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

  test('Royal Original and Showood tables remain selectable', () => {
    assert.deepEqual(
      POOL_ROYALE_TABLE_MODEL_OPTIONS.map((option) => option.id),
      ['royal-original', 'showood-seven-foot']
    );
    assert.equal(
      resolvePoolRoyaleTableModel('traditional-fizyman-eight-foot').id,
      'royal-original'
    );
  });

  test('Pool Royale lobby exposes model choices with Royal Original guidance', async () => {
    const lobby = await readFile(
      'webapp/src/pages/Games/PoolRoyaleLobby.jsx',
      'utf8'
    );

    assert.ok(
      lobby.includes('Royal Original keeps the clean procedural table'),
      'lobby should explain the Royal Original table'
    );
    assert.equal(
      lobby.includes('POOL_ROYALE_TABLE_MODEL_OPTIONS.map'),
      true,
      'lobby should render table model option cards'
    );
    assert.equal(
      lobby.includes('setTableModelId'),
      true,
      'lobby should allow switching table models'
    );
    assert.equal(
      lobby.includes('traditional-fizyman-eight-foot'),
      false,
      'lobby should not reference the removed 8 ft glTF table'
    );
  });
});
