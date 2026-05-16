import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
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

  test('Traditional Sketchfab table is selectable as a generated local GLB option', () => {
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
    assert.equal(
      traditional.assetUrl,
      '/models/pool-royale/pool-table-traditional-fizyman.glb'
    );
    assert.equal(
      traditional.generatorScript,
      'npm run generate:pool-royale-traditional-table'
    );
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

  test('Traditional table source code is complete and generates a GLB', async () => {
    const source = await readFile(
      'webapp/scripts/generate-pool-royale-traditional-table.mjs',
      'utf8'
    );
    const tmpDir = await mkdtemp(join(tmpdir(), 'pool-royale-table-'));
    const output = join(tmpDir, 'traditional-table.glb');

    try {
      execFileSync(
        'node',
        [
          'webapp/scripts/generate-pool-royale-traditional-table.mjs',
          '--output',
          output
        ],
        { stdio: 'pipe' }
      );
      const generated = await stat(output);

      assert.ok(source.includes('createTraditionalPoolTableScene'));
      assert.ok(source.includes('playing_surface_green_felt_cloth'));
      assert.ok(source.includes('black_leather_pocket_cup_'));
      assert.ok(source.includes('turned_wood_leg_support_'));
      assert.ok(source.includes('brass_diamond_rail_sight_'));
      assert.ok(generated.isFile());
      assert.ok(generated.size > 100_000);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('Traditional table keeps source and attribution files in git instead of binary GLB', async () => {
    const generator = await stat(
      'webapp/scripts/generate-pool-royale-traditional-table.mjs'
    );
    const license = await stat(
      'webapp/public/models/pool-royale/pool-table-traditional-fizyman.LICENSE.md'
    );

    assert.ok(generator.isFile());
    assert.ok(generator.size > 9_000);
    assert.ok(license.isFile());
  });
});
