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
    assert.equal(showood.fitScale, 1);
    assert.equal(showood.clothRepeatScale, 7.5);
    assert.deepEqual(showood.hideSurfaceRoles, []);
    assert.deepEqual(showood.preserveOriginalSurfaceRoles, []);
    assert.equal(showood.tintOriginalTrimGold, true);
    assert.deepEqual(showood.chromeMaterialSurfaceNames, [
      'diamonds',
      'railSight'
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
    assert.equal(showood.fitHeightScale, 1);
  });

  test('Showood is the only Pool Royale table model exposed by default', () => {
    assert.deepEqual(
      POOL_ROYALE_TABLE_MODEL_OPTIONS.map((option) => option.id),
      ['showood-seven-foot']
    );
    assert.equal(
      resolvePoolRoyaleTableModel('traditional-fizyman-eight-foot').id,
      'showood-seven-foot'
    );
  });

  test('Pool Royale lobby no longer exposes table model selection controls', async () => {
    const lobby = await readFile(
      'webapp/src/pages/Games/PoolRoyaleLobby.jsx',
      'utf8'
    );

    assert.equal(lobby.includes('POOL_ROYALE_TABLE_MODEL_OPTIONS'), false);
    assert.equal(lobby.includes('setTableModelId'), false);
    assert.equal(lobby.includes('Pool Table'), false);
    assert.equal(lobby.includes('Selectable · install for glTF'), false);
    assert.ok(
      lobby.includes("params.set('tableModel', selectedTableModel.id)")
    );
  });

  test('Pool Royale human cue pose keeps Snooker Champion right-hand stance signs', async () => {
    const poolSource = await readFile(
      'webapp/src/pages/Games/PoolRoyale.jsx',
      'utf8'
    );

    assert.match(
      poolSource,
      /human\.yaw = poolHumanDampScalar\([\s\S]*poolHumanYawFromForward\(aimForward\)[\s\S]*POOL_HUMAN_CFG\.rotLambda/
    );
    assert.ok(
      poolSource.includes(
        '(poolHumanLerp(0, -0.46, t) - 0.018 * human.settleT)'
      )
    );
    assert.ok(
      poolSource.includes(
        '.setY(POOL_HUMAN_CFG.tableTopY + POOL_HUMAN_CFG.bridgePalmTableLift)'
      )
    );
    assert.equal(poolSource.includes('poolHumanDampAngle'), false);
    assert.equal(
      poolSource.includes('POOL_HUMAN_CUE_BUTT_STANCE_INSET'),
      false
    );
  });
});
