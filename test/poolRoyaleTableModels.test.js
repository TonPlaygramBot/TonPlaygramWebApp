import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import {
  DEFAULT_POOL_ROYALE_TABLE_MODEL_ID,
  POOL_ROYALE_TABLE_MODEL_OPTIONS,
  resolvePoolRoyaleTableModel
} from '../webapp/src/config/poolRoyaleTableModels.js';

describe('Pool Royale table models', () => {
  test('defaults to the Snooker Generic GLB table', () => {
    assert.equal(DEFAULT_POOL_ROYALE_TABLE_MODEL_ID, 'snooker-generic');
    assert.equal(resolvePoolRoyaleTableModel(null).id, 'snooker-generic');
    assert.equal(
      resolvePoolRoyaleTableModel('unknown').id,
      'snooker-generic'
    );
  });

  test('snooker generic table keeps Pool Royale dimensions while using the shared open-source GLB', () => {
    const snookerGeneric = POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === 'snooker-generic'
    );

    assert.ok(snookerGeneric, 'snooker generic table model must be configured');
    assert.equal(snookerGeneric.kind, 'gltf');
    assert.equal(snookerGeneric.fitScale, 1);
    assert.equal(snookerGeneric.preserveOriginalFootprintAspect, true);
    assert.equal(snookerGeneric.lowerBaseHeightScale, 1.38);
    assert.equal(snookerGeneric.legLengthScale, 2.05);
    assert.equal(snookerGeneric.clothRepeatScale, 7.5);
    assert.deepEqual(snookerGeneric.hideSurfaceRoles, []);
    assert.equal(snookerGeneric.tintOriginalTrimGold, true);
    assert.deepEqual(snookerGeneric.usePoolRoyaleFinishRoles, [
      'cloth',
      'cushion',
      'pocket',
      'trim',
      'wood',
      'topWoodRail',
      'sideWoodApron',
      'railSight',
      'verticalCornerRim',
      'baseCornerBlock',
      'leg',
      'baseFoot'
    ]);
    assert.equal('playfieldVisualLift' in snookerGeneric, false);
    assert.equal(snookerGeneric.fitHeightScale, 1);
  });

  test('Traditional Sketchfab 8 ft glTF table is no longer selectable', () => {
    assert.equal(
      POOL_ROYALE_TABLE_MODEL_OPTIONS.some(
        (option) => option.id === 'traditional-fizyman-eight-foot'
      ),
      false
    );
    assert.equal(
      resolvePoolRoyaleTableModel('traditional-fizyman-eight-foot').id,
      'snooker-generic'
    );
  });

  test('Pool Royale lobby no longer references removed Showood/Traditional messaging', async () => {
    const lobby = await readFile(
      'webapp/src/pages/Games/PoolRoyaleLobby.jsx',
      'utf8'
    );

    assert.equal(
      lobby.includes('showood-seven-foot'),
      false,
      'lobby should not reference the removed Showood model id'
    );
    assert.equal(
      lobby.includes('traditional-fizyman-eight-foot'),
      false,
      'lobby should not reference the removed 8 ft glTF table'
    );
  });

  test('Traditional table installer fetches and validates the authentic Sketchfab glTF', async () => {
    const source = await readFile(
      'webapp/scripts/fetch-pool-royale-traditional-table.mjs',
      'utf8'
    );
    const help = execFileSync(
      'node',
      ['webapp/scripts/fetch-pool-royale-traditional-table.mjs', '--help'],
      { encoding: 'utf8' }
    );

    assert.ok(source.includes('e0b938c0c2e74eb794a49ebde2543977'));
    assert.ok(source.includes('https://api.sketchfab.com/v3/models/'));
    assert.ok(source.includes('data?.gltf?.url'));
    assert.ok(source.includes('validateAuthenticTraditionalGltf'));
    assert.ok(source.includes('minTriangles: 20000'));
    assert.ok(source.includes('minTextures: 10'));
    assert.ok(source.includes('validateExternalReferences'));
    assert.ok(source.includes("targetFileName: 'scene.gltf'"));
    assert.ok(help.includes('SKETCHFAB_TOKEN=<token>'));
    assert.ok(help.includes('--from /path/to/authentic-sketchfab-gltf.zip'));
  });

  test('Traditional table keeps installer and attribution files in git instead of model binaries', async () => {
    const installer = await stat(
      'webapp/scripts/fetch-pool-royale-traditional-table.mjs'
    );
    const license = await stat(
      'webapp/public/models/pool-royale/pool-table-traditional-fizyman.LICENSE.md'
    );

    assert.ok(installer.isFile());
    assert.ok(installer.size > 8_000);
    assert.ok(license.isFile());
  });
});
