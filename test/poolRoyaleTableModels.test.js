import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
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

  test('Traditional Sketchfab table is selectable as an authentic local glTF option', () => {
    const traditional = POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === 'traditional-fizyman-eight-foot'
    );

    assert.ok(
      traditional,
      'Traditional Sketchfab table model must be configured'
    );
    assert.equal(
      resolvePoolRoyaleTableModel('traditional-fizyman-eight-foot').id,
      traditional.id
    );
    assert.equal(traditional.kind, 'gltf');
    assert.equal(traditional.assetFormat, 'glTF');
    assert.equal(
      traditional.assetUrl,
      '/models/pool-royale/pool-table-traditional-fizyman/scene.gltf'
    );
    assert.equal(
      traditional.installScript,
      'npm run fetch:pool-royale-traditional-table'
    );
    assert.equal(traditional.sourceUid, 'e0b938c0c2e74eb794a49ebde2543977');
    assert.equal(traditional.sourceFormat, 'sketchfab-original-gltf');
    assert.equal(traditional.tableSizeId, '8ft');
    assert.equal(traditional.fitStrategy, 'exact');
    assert.equal(traditional.fitReference, 'upperTabletop');
    assert.equal(traditional.fitScale, 1);
    assert.equal(traditional.fitHeightScale, 1);
    assert.equal(traditional.useOriginalLayoutSurfaces, true);
    assert.deepEqual(traditional.usePoolRoyaleFinishRoles, [
      'cloth',
      'cushion',
      'wood',
      'pocket'
    ]);
    assert.equal(
      traditional.sourceUrl,
      'https://sketchfab.com/3d-models/pool-table-traditional-e0b938c0c2e74eb794a49ebde2543977'
    );
    assert.equal(traditional.author, 'fizyman');
    assert.equal(traditional.license, 'CC Attribution 4.0');
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
