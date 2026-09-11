import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import {
  ALBANIAN_FORCES_ASSETS,
  ALBANIAN_FORCES_VEHICLES,
  ALBANIAN_FORCES_CHARACTERS,
  albanianForcesAssetUrl
} from '../webapp/src/games/kartroyale/albanianForcesCatalog.mjs';
import {
  KARTS,
  makeTrack,
  equipKart,
  createRacer,
  normalizeKart,
  aiInput,
  stepRacer,
  STEP
} from '../webapp/src/games/kartroyale/simulation.mjs';
const require = createRequire(
  new URL('../webapp/package.json', import.meta.url)
);
const ts = require('typescript');
const threeURL = new URL(
  '../webapp/node_modules/three/build/three.module.js',
  import.meta.url
).href;
const THREE = await import(threeURL);
const { GLTFLoader } = await import(
  pathToFileURL(require.resolve('three/examples/jsm/loaders/GLTFLoader.js'))
    .href
);
const directory = new URL('../webapp/src/games/kartroyale/', import.meta.url);
async function importTS(name) {
  const source = await fs.readFile(new URL(name, directory), 'utf8');
  const code = ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022
      }
    })
    .outputText.replace(
      /from (['"])([^'"]+)\1/g,
      (_, quote, id) =>
        `from ${JSON.stringify(id === 'three' ? threeURL : id.startsWith('.') ? new URL(id, directory).href : pathToFileURL(require.resolve(id)).href)}`
    );
  return import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
}
const { prepareVehicleAsset } = await importTS('vehicleAssetAdapter.ts');
const loader = new GLTFLoader();
// Load real mesh/rig/animation data; texture decoding is verified separately.
loader.register(() => ({
  name: 'TEST_TEXTURE_PLACEHOLDER',
  loadTexture: async () => new THREE.Texture()
}));
async function readGLB(id, low = false) {
  const bytes = await fs.readFile(
    new URL(
      `../webapp/public${albanianForcesAssetUrl(id, low)}`,
      import.meta.url
    )
  );
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  assert.equal(json.asset.version, '2.0');
  assert(!json.extensionsRequired?.length);
  assert(json.images.every((i) => i.bufferView !== undefined && !i.uri));
  for (const v of json.bufferViews)
    assert((v.byteOffset || 0) + v.byteLength <= json.buffers[0].byteLength);
  return {
    bytes,
    json,
    ...(await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      ''
    ))
  };
}
test('eight additions preserve the original nine IDs and reject invalid paths', () => {
  assert.equal(KARTS.length, 17);
  assert.equal(new Set(KARTS.map((k) => k.id)).size, 17);
  assert.deepEqual(
    KARTS.slice(0, 9).map((k) => k.id),
    [
      'apex',
      'oobi',
      'oodi',
      'ooli',
      'oopi',
      'shota',
      'brabus-g',
      'defender',
      'brabus-s65'
    ]
  );
  assert.throws(() => albanianForcesAssetUrl('../../secret'));
  for (const v of ALBANIAN_FORCES_VEHICLES)
    assert.equal(normalizeKart(v.id), v.id);
});
for (const vehicle of ALBANIAN_FORCES_VEHICLES) {
  test(`${vehicle.id}: full/LOD fit, forward orientation, wheel pivots and camera clearance`, async () => {
    const full = await readGLB(vehicle.id),
      low = await readGLB(vehicle.id, true);
    assert(low.bytes.length < full.bytes.length * 0.6);
    const prepared = prepareVehicleAsset(full.scene, vehicle.id);
    const lod = prepareVehicleAsset(
      low.scene,
      vehicle.id,
      prepared.userData.vehicleFit
    );
    for (const root of [prepared, lod]) {
      const bounds = new THREE.Box3().setFromObject(root);
      assert(Math.abs(bounds.max.z - bounds.min.z - 2.7) < 0.05);
      assert(Math.abs(bounds.min.y) < 0.025);
      const front =
        root.getObjectByName('Steer_FL') || root.getObjectByName('Steer_F');
      const rear =
        root.getObjectByName('Wheel_RL') || root.getObjectByName('Wheel_R');
      assert(front && rear);
      assert(
        front.getWorldPosition(new THREE.Vector3()).z >
          rear.getWorldPosition(new THREE.Vector3()).z
      );
      const pivot = front.getWorldPosition(new THREE.Vector3());
      front.rotation.y = 0.25;
      root.updateMatrixWorld(true);
      assert(
        front.getWorldPosition(new THREE.Vector3()).distanceTo(pivot) < 1e-6
      );
      const ray = new THREE.Raycaster(
        new THREE.Vector3(...root.userData.driverEye),
        new THREE.Vector3(0, 0, 1),
        0.04,
        10
      );
      assert.equal(
        ray.intersectObject(root, true).length,
        0,
        'Camera forward view is clear'
      );
      assert(
        Math.abs(
          root.userData.wheelRadius -
            ALBANIAN_FORCES_ASSETS[vehicle.id].wheelRadius *
              root.userData.vehicleFit.scale
        ) < 1e-8
      );
    }
  });
  test(`${vehicle.id}: finishes the circuit and preserves phone steering/braking`, () => {
    const track = makeTrack('skanderbeg'),
      r = equipKart(createRacer(track, 'ai', 'AI', 0, true), vehicle.id);
    for (let t = 0; t < 480 && !r.finished; t += STEP)
      stepRacer(r, aiInput(r, track, t, 'rookie'), track, STEP, t, 'rookie');
    assert(r.finished && r.gates === 13);
    for (const steer of [-1, 1]) {
      const raceTrack = { ...track, width: 1000 },
        driver = equipKart(createRacer(raceTrack, 'you', 'You'), vehicle.id);
      driver.speed = 20;
      const yaw = driver.yaw;
      stepRacer(
        driver,
        {
          steer,
          brake: false,
          drift: false,
          boost: false,
          shield: false,
          fire: false
        },
        raceTrack,
        STEP,
        1
      );
      assert.equal(Math.sign(driver.yaw - yaw), -steer);
      for (let i = 0; i < 150; i++)
        stepRacer(driver, { steer: 0, brake: true }, raceTrack, STEP, i * STEP);
      assert.equal(driver.speed, 0);
    }
  });
}
for (const id of ALBANIAN_FORCES_CHARACTERS)
  test(`${id}: LOD keeps a working skeleton and Idle/Walk clips`, async () => {
    const { scene, animations, json } = await readGLB(id, true);
    assert.deepEqual(animations.map((a) => a.name).sort(), ['Idle', 'Walk']);
    assert(json.skins[0].joints.length >= 100);
    const mixer = new THREE.AnimationMixer(scene);
    for (const clip of animations) {
      mixer.stopAllAction();
      mixer.clipAction(clip).play();
      mixer.update(0.5);
      scene.updateMatrixWorld(true);
      scene.traverse((o) => {
        assert(o.matrixWorld.elements.every(Number.isFinite));
        if (o instanceof THREE.SkinnedMesh) {
          o.skeleton.update();
          const p = new THREE.Vector3();
          for (let i = 0; i < o.geometry.attributes.position.count; i += 500) {
            o.getVertexPosition(i, p);
            assert(p.toArray().every(Number.isFinite));
          }
        }
      });
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(scene);
  });
const { loadTS, deferred, flush } = require('../test/runtime-harness.cjs');
const catalog =
  await import('../webapp/src/games/kartroyale/albanianForcesCatalog.mjs');
const simulation =
  await import('../webapp/src/games/kartroyale/simulation.mjs');
const config =
  await import('../webapp/src/games/kartroyale/vehicleAssetConfig.mjs');
const military =
  await import('../webapp/src/games/kartroyale/militaryVehicleCatalog.mjs');
const scenery = await importTS('baseTiranaScenery.ts');
function fixture() {
  const requests = [];
  class DeferredLoader {
    loadAsync(url) {
      const d = deferred();
      requests.push({ url, ...d });
      return d.promise;
    }
  }
  const shared = {
    three: THREE,
    './albanianForcesCatalog.mjs': catalog,
    './tiranaScenery': scenery,
    'three/examples/jsm/loaders/GLTFLoader.js': { GLTFLoader: DeferredLoader }
  };
  const layer = loadTS(
    new URL('AlbanianForcesLayer.ts', directory).pathname,
    shared
  );
  const { KartRenderer } = loadTS(new URL('renderer.ts', directory).pathname, {
    ...shared,
    './AlbanianForcesLayer': layer,
    './simulation.mjs': simulation,
    './militaryVehicleCatalog.mjs': military,
    './vehicleAssetConfig.mjs': config,
    './vehicleAssetAdapter': { prepareVehicleAsset },
    'three/examples/jsm/environments/RoomEnvironment.js': {},
    './supporters': {},
    './supporterHuman': {},
    './raceEffects': {},
    './trackEdges.mjs': {}
  });
  const renderer = Object.create(KartRenderer.prototype);
  Object.assign(renderer, {
    full: new THREE.Group(),
    low: new THREE.Group(),
    kartId: 'apex',
    kartModels: new Map(),
    kartLowModels: new Map(),
    vehicleLoads: new Map(),
    failedVehicles: new Set(),
    textures: new Set(),
    rigs: new WeakMap(),
    showroom: new THREE.Group(),
    color: '#baff29',
    disposed: false
  });
  const model = () => {
    const scene = new THREE.Group(),
      texture = new THREE.Texture(),
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2, 2),
        new THREE.MeshStandardMaterial({ map: texture })
      );
    scene.add(mesh);
    return { scene, texture, mesh, animations: [] };
  };
  return { renderer, requests, model, Layer: layer.AlbanianForcesLayer };
}
test('late selection results cannot replace the newest showroom vehicle', async () => {
  const { renderer, requests, model } = fixture();
  const a = renderer.setKart('patrol_hatch'),
    b = renderer.setKart('police_van');
  requests[1].resolve(model());
  await b;
  requests[0].resolve(model());
  await a;
  assert.equal(renderer.showroom.children.length, 1);
  assert.equal(renderer.showroom.children[0].userData.kartId, 'police_van');
});
test('vehicle requests deduplicate and a failed selection can retry', async () => {
  const { renderer, requests, model } = fixture();
  const a = renderer.ensureVehicle('patrol_hatch'),
    b = renderer.ensureVehicle('patrol_hatch');
  assert.equal(requests.length, 1);
  requests[0].resolve(model());
  await Promise.all([a, b]);
  const failed = renderer.setKart('police_van');
  requests[1].reject(Error('offline'));
  await assert.rejects(failed);
  const retry = renderer.setKart('police_van');
  requests[2].resolve(model());
  await retry;
  assert.equal(renderer.showroom.children[0].userData.kartId, 'police_van');
});
test('leaving during a download disposes late model resources', async () => {
  const { renderer, requests, model } = fixture(),
    asset = model(),
    counts = [0, 0, 0];
  [asset.mesh.geometry, asset.mesh.material, asset.texture].forEach((v, i) =>
    v.addEventListener('dispose', () => counts[i]++)
  );
  const pending = renderer.ensureVehicle('patrol_hatch');
  renderer.disposed = true;
  requests[0].resolve(asset);
  await pending;
  assert.deepEqual(counts, [1, 1, 1]);
  assert.equal(renderer.kartModels.size, 0);
});
test('six officials on every circuit avoid the road/buildings and load only nearby', async () => {
  const { Layer, requests, model } = fixture();
  for (const c of simulation.TRACKS) {
    const track = makeTrack(c.id),
      layer = new Layer(track);
    assert.equal(layer.posts.length, 6, track.id);
    for (const p of layer.posts) {
      assert(!scenery.occupied(p.x, p.z));
      assert(
        track.points.every(
          (q) => Math.hypot(q.x - p.x, q.z - p.z) >= track.width / 2 + 1.5
        )
      );
    }
    layer.update(1e9, 1e9, 0.016, false);
    assert.equal(requests.length, 0);
    layer.dispose();
  }
  const layer = new Layer(makeTrack()),
    post = layer.posts[0];
  layer.update(post.x, post.z, 0.016, false);
  assert.equal(requests.length, 1);
  assert(requests[0].url.endsWith('-lod.glb'));
  layer.dispose();
  requests[0].resolve(model());
  await flush();
  assert.equal(layer.group.children.length, 0);
});
