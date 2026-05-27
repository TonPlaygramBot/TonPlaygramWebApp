import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import {
  DEFAULT_POOL_ROYALE_TABLE_MODEL_ID,
  POOL_ROYALE_TABLE_MODEL_OPTIONS,
  resolvePoolRoyaleTableModel
} from '../webapp/src/config/poolRoyaleTableModels.js';

describe('Pool Royale table models', () => {
  test('defaults to the procedural Pool Royale table', () => {
    assert.equal(DEFAULT_POOL_ROYALE_TABLE_MODEL_ID, 'royal-procedural');
    assert.equal(resolvePoolRoyaleTableModel(null).id, 'royal-procedural');
    assert.equal(
      resolvePoolRoyaleTableModel('unknown').id,
      'royal-procedural'
    );
  });

  test('procedural model keeps the classic generated table configuration', () => {
    const procedural = POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === 'royal-procedural'
    );

    assert.ok(procedural, 'procedural table model must be configured');
    assert.equal(procedural.kind, 'procedural');
    assert.equal(procedural.baseId, 'classicCylinders');
    assert.equal(procedural.tableSizeId, '7ft');
    assert.equal('assetUrl' in procedural, false);
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
      'royal-procedural'
    );
  });

  test('Pool Royale lobby still references the previously fixed Showood copy', async () => {
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
