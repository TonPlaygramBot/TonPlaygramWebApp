// CPU scene/asset integration only. This does not claim a WebGL or device test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from '../webapp/node_modules/typescript/lib/typescript.js';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import * as surface from '../webapp/src/games/tirana-environment/surfaceCore.mjs';
import * as parkGround from '../webapp/src/games/tirana-environment/parkGroundCore.mjs';
import * as vegetation from '../webapp/src/games/kartroyale/racingVegetationCore.mjs';
import { WORLD } from '../webapp/src/games/tiranastreets/shared/world.mjs';
import { makeTrack } from '../webapp/src/games/kartroyale/simulation.mjs';
const webapp = fileURLToPath(new URL('../webapp/', import.meta.url));
function load(file, deps) {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(webapp + file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText;
  vm.runInNewContext(js, {
    module,
    exports: module.exports,
    require: (key) => {
      if (key in deps) return deps[key];
      throw Error('Unmocked dependency ' + key);
    },
    performance,
    console,
    setTimeout,
    clearTimeout
  });
  return module.exports;
}
test('generated GLTF species actually populate clipped Tirana parks and respect LOD/disposal', async () => {
  execFileSync(
    process.execPath,
    ['scripts/generate-tirana-street-furniture.mjs'],
    { cwd: webapp, stdio: 'pipe' }
  );
  const pending = [],
    bytes = fs.readFileSync(
      webapp + 'public/assets/tirana-streets/street-furniture.glb'
    );
  class LocalLoader {
    load(url, done) {
      assert.equal(url, '/assets/tirana-streets/street-furniture.glb');
      pending.push(
        new GLTFLoader()
          .parseAsync(
            bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength
            ),
            ''
          )
          .then(done)
      );
    }
  }
  class TextureStub {
    load(url, done) {
      assert.ok(fs.existsSync(webapp + 'public' + url));
      const t = new T.Texture();
      done?.(t);
      return t;
    }
  }
  const three = { ...T, TextureLoader: TextureStub },
    release = {
      disposeKartSource(root) {
        root.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.geometry.dispose();
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material])
              m.dispose();
          }
        });
      }
    };
  const { RacingVegetation } = load(
    'src/games/kartroyale/RacingVegetation.ts',
    {
      three: three,
      'three/examples/jsm/loaders/GLTFLoader.js': { GLTFLoader: LocalLoader },
      './racingVegetationCore.mjs': vegetation,
      './SuppliedKartModels': release
    }
  );
  const { GroundDetailLayer } = load(
    'src/games/tirana-environment/GroundDetailLayer.ts',
    {
      three: three,
      './surfaceCore.mjs': surface,
      './parkGroundCore.mjs': parkGround,
      '../kartroyale/RacingVegetation': { RacingVegetation }
    }
  );
  const errors = [],
    track = makeTrack(),
    ground = new GroundDetailLayer(WORLD, { profile: 'racing', track }, errors);
  await Promise.all(pending);
  assert.deepEqual(errors, []);
  const trees = ground.group.getObjectByName(
    'Tirana:glTF-park-trees-and-undergrowth'
  );
  assert.ok(trees.userData.counts.trees > 100);
  assert.ok(trees.userData.counts.grass > 1000);
  for (const name of [
    'tree_plane',
    'tree_linden',
    'tree_cypress',
    'race_grass',
    'race_shrub',
    'race_flowers'
  ])
    assert.ok(trees.getObjectByName(name), 'GLTF node ' + name);
  const firstCell = trees.children.find((c) =>
    c.name.startsWith('tree_plane:')
  );
  assert.ok(firstCell);
  const location = firstCell.children[0].boundingSphere.center;
  ground.update(location, false);
  assert.equal(firstCell.visible, true);
  ground.update(location, true);
  assert.equal(firstCell.visible, false, 'battery mode uses low-detail trees');
  ground.dispose();
  ground.dispose();
  assert.equal(trees.parent, null);
});
