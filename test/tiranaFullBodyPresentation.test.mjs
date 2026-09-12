import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
const webapp = fileURLToPath(new URL('../webapp/', import.meta.url)),
  require = createRequire(join(webapp, 'package.json'));
const { build } = require('esbuild'),
  { JSDOM } = require('jsdom'),
  T = await import(
    pathToFileURL(join(webapp, 'node_modules/three/build/three.module.js'))
  );
const dir = mkdtempSync(join(webapp, '.career-test-'));
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
after(() => rmSync(dir, { recursive: true, force: true }));
const bundle = async (name) => {
  const out = join(dir, name + '.mjs');
  await build({
    entryPoints: [
      join(webapp, 'src/games/tiranastreets/street-career/' + name + '.ts')
    ],
    outfile: out,
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['three', 'three/*'],
    logLevel: 'silent'
  });
  return import(pathToFileURL(out));
};
const { FirstPersonBody, maskHead } = await bundle('FirstPersonBody'),
  { StreetInput } = await bundle('StreetInput');
const { GLTFLoader } = await import(
  pathToFileURL(require.resolve('three/examples/jsm/loaders/GLTFLoader.js'))
);
const { clone } = await import(
  pathToFileURL(require.resolve('three/examples/jsm/utils/SkeletonUtils.js'))
);
const dom = new JSDOM('<!doctype html><div></div>', {
  url: 'http://localhost'
});
for (const key of [
  'window',
  'document',
  'HTMLInputElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'KeyboardEvent'
])
  globalThis[key] = dom.window[key];
globalThis.ProgressEvent = class {
  constructor(type, init) {
    this.type = type;
    Object.assign(this, init);
  }
};
const source = readFileSync(
    join(webapp, 'public/assets/tirana-streets/living/human.glb')
  ),
  length = source.readUInt32LE(12),
  json = JSON.parse(source.subarray(20, 20 + length));
// Read the real skin, skeleton and clips. Texture decoding requires WebGL/browser
// and is deliberately NOT part of these numeric rig tests.
const bin = source.subarray(28 + length);
json.buffers[0].uri =
  'data:application/octet-stream;base64,' + bin.toString('base64');
delete json.images;
delete json.textures;
delete json.materials;
for (const m of json.meshes) for (const p of m.primitives) delete p.material;
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
const makeActor = () => {
  const model = clone(gltf.scene),
    root = new T.Group();
  root.add(model);
  model.updateMatrixWorld(true);
  let box = new T.Box3().setFromObject(model),
    c = box.getCenter(new T.Vector3()),
    scale = 1.78 / (box.max.y - box.min.y);
  model.scale.setScalar(scale);
  model.position.set(-c.x * scale, -box.min.y * scale, -c.z * scale);
  const mixer = new T.AnimationMixer(root),
    actor = { group: root, mixer, model: 'character', wheels: [] };
  for (const key of ['idle', 'walk', 'run'])
    actor[key] = mixer.clipAction(
      gltf.animations.find((c) => c.name.toLowerCase() === key)
    );
  return actor;
};
const { createBody } = await import(
  '../webapp/src/games/tiranastreets/street-career/playerCore.mjs'
);

test('real Mixamo single mesh keeps body triangles and skeleton after head masking', () => {
  const a = makeActor(),
    meshes = [];
  a.group.traverse((o) => {
    if (o instanceof T.SkinnedMesh) meshes.push(o);
  });
  const before = meshes.map((m) => ({
    geometry: m.geometry,
    count: m.geometry.index?.count || m.geometry.attributes.position.count,
    skeleton: m.skeleton,
    bones: m.skeleton.bones.length
  }));
  const release = maskHead(a.group);
  assert.ok(
    meshes.some(
      (m, i) =>
        m.geometry.index.count < before[i].count && m.geometry.index.count > 0
    )
  );
  for (let i = 0; i < meshes.length; i++) {
    assert.equal(meshes[i].skeleton, before[i].skeleton);
    assert.equal(meshes[i].skeleton.bones.length, before[i].bones);
    assert.notEqual(meshes[i].geometry, before[i].geometry);
  }
  release();
});
test('bound real player shows feet below eye and extends a hand during punch', () => {
  const actor = makeActor(),
    scene = new T.Scene();
  scene.add(actor.group);
  const rig = new FirstPersonBody(scene),
    b = createBody(0),
    p = { x: 0, z: 0, health: 100, speed: 0, weapon: '', nextShot: 0 };
  rig.update(actor, p, b, 0, 1 / 60);
  const bone = (name) => {
    let value;
    actor.group.traverse((o) => {
      if (
        o instanceof T.Bone &&
        o.name.replace(/[^A-Za-z]/g, '').endsWith(name)
      )
        value = o;
    });
    return value;
  };
  const leftFoot = bone('LeftFoot'),
    rightHand = bone('RightHand');
  assert.ok(leftFoot && rightHand);
  scene.updateMatrixWorld(true);
  const foot = leftFoot.getWorldPosition(new T.Vector3());
  assert.ok(foot.y < 0.35);
  const camera = new T.PerspectiveCamera(74, 390 / 844, 0.035, 100);
  camera.position.set(0, b.y + b.eye, 0);
  camera.lookAt(0, 0.1, -0.3);
  camera.updateMatrixWorld(true);
  const projected = foot.clone().project(camera);
  assert.ok(
    Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1,
    'foot visible looking down'
  );
  const start = rightHand.getWorldPosition(new T.Vector3());
  b.action = { kind: 'punch', hand: 1, start: 0, duration: 0.42 };
  rig.update(actor, p, b, 0.21, 1 / 60);
  scene.updateMatrixWorld(true);
  const end = rightHand.getWorldPosition(new T.Vector3());
  assert.ok(end.z < start.z - 0.08, `hand reach ${start.z} -> ${end.z}`);
  rig.dispose();
});
test('crouch lowers the actual rig and kick raises the actual foot', () => {
  const a = makeActor(),
    scene = new T.Scene(),
    rig = new FirstPersonBody(scene),
    b = createBody(0),
    p = { x: 0, z: 0, health: 100, speed: 0, weapon: '', nextShot: 0 };
  scene.add(a.group);
  let foot, hips;
  a.group.traverse((o) => {
    if (o.name.endsWith('RightFoot')) foot = o;
    if (o.name.endsWith('Hips')) hips = o;
  });
  rig.update(a, p, b, 0, 0.1);
  scene.updateMatrixWorld(true);
  const start = foot.getWorldPosition(new T.Vector3()),
    height = hips.getWorldPosition(new T.Vector3()).y;
  b.crouched = true;
  b.height = 1.08;
  b.eye = 0.94;
  rig.update(a, p, b, 0.1, 0.1);
  scene.updateMatrixWorld(true);
  assert.ok(hips.getWorldPosition(new T.Vector3()).y < height - 0.3);
  assert.ok(
    foot.getWorldPosition(new T.Vector3()).y > -0.18,
    'crouched foot should not sink below street'
  );
  b.crouched = false;
  b.height = 1.78;
  b.eye = 1.62;
  b.action = { kind: 'kick', start: 0, duration: 0.68 };
  rig.update(a, p, b, 0.34, 0.1);
  scene.updateMatrixWorld(true);
  const end = foot.getWorldPosition(new T.Vector3());
  assert.ok(end.y > start.y + 0.25);
  assert.ok(end.z < start.z - 0.3);
  rig.dispose();
});
test('body rig does not mutate shared source animation tracks', () => {
  const sourceClips = gltf.animations.map((c) =>
      c.tracks.map((t) => Array.from(t.values))
    ),
    actor = makeActor(),
    scene = new T.Scene(),
    rig = new FirstPersonBody(scene),
    b = createBody(0);
  scene.add(actor.group);
  rig.update(
    actor,
    { x: 0, z: 0, health: 100, speed: 2, weapon: '', nextShot: 0 },
    b,
    1,
    1 / 60
  );
  assert.deepEqual(
    gltf.animations.map((c) => c.tracks.map((t) => Array.from(t.values))),
    sourceClips
  );
  rig.dispose();
});
test('two fingers can move and fire-drag, cancellation only clears its owner', () => {
  const actions = [],
    looks = [],
    input = new StreetInput(
      (a) => actions.push(a),
      (x, y) => looks.push([x, y])
    );
  assert.equal(input.pointerDown(1, 'move', 20, 700), true);
  input.touch.x = 0.5;
  input.touch.y = 0.7;
  assert.equal(input.pointerDown(2, 'fire', 300, 650), true);
  input.pointerMove(2, 310, 630);
  assert.deepEqual(looks, [[10, -20]]);
  let i = input.readStreet(0, 0.5, false);
  assert.equal(i.fire, true);
  assert.equal(i.x, 0.5);
  assert.equal(i.pitch, 0.5);
  input.pointerUp(2);
  i = input.readStreet(0, 0.5, false);
  assert.equal(i.fire, false);
  assert.equal(i.x, 0.5);
  assert.equal(input.pointerDown(3, 'move', 0, 0), false);
  input.pointerUp(99);
  assert.equal(input.touch.x, 0.5);
  input.pointerUp(1);
  assert.equal(input.touch.x, 0);
  input.destroy();
});
test('pause/blur releases held inputs and desktop emits the same action IDs', () => {
  const actions = [],
    input = new StreetInput(
      (a) => actions.push(a),
      () => {}
    );
  for (const [key, code] of [
    [' ', 'Space'],
    ['c', 'KeyC'],
    ['v', 'KeyV'],
    ['z', 'KeyZ'],
    ['b', 'KeyB']
  ])
    window.dispatchEvent(new KeyboardEvent('keydown', { key, code }));
  assert.ok(
    ['jump', 'crouch', 'kick', 'aim', 'guard'].every((id) =>
      actions.includes(id)
    )
  );
  input.pointerDown(4, 'fire', 10, 10);
  input.setEnabled(false);
  assert.equal(input.readStreet(0, 0, false).fire, false);
  input.setEnabled(true);
  assert.equal(input.pointerDown(4, 'fire', 10, 10), true);
  window.dispatchEvent(new dom.window.Event('blur'));
  assert.equal(input.readStreet(0, 0, false).fire, false);
  input.destroy();
});

test('real driver hands stay at the canonical cabin wheel while looking sideways', async () => {
  const { carPoint, vehicleAnchors } = await import(
    '../webapp/src/games/tiranastreets/street-career/vehicleCore.mjs'
  );
  const { driverEye } = await import(
    '../webapp/src/games/tiranastreets/shared/driverView.mjs'
  );
  const car = {
    id: 'car',
    x: 30,
    z: 20,
    heading: 0.7,
    steering: 0,
    model: 'city-car'
  };
  const actor = makeActor(),
    scene = new T.Scene();
  scene.add(actor.group);
  const rig = new FirstPersonBody(scene),
    b = createBody(0);
  const p = {
    x: car.x,
    z: car.z,
    health: 100,
    speed: 0,
    weapon: '',
    nextShot: 0,
    carId: car.id
  };
  b.yaw = car.heading;
  rig.update(actor, p, b, 0, 0, car);
  actor.group.updateMatrixWorld(true);
  const hands = [];
  actor.group.traverse((o) => {
    if (o instanceof T.Bone && /(?:Left|Right)Hand$/.test(o.name))
      hands.push(o);
  });
  assert.equal(hands.length, 2);
  const before = hands.map((o) => o.getWorldPosition(new T.Vector3()));
  const wheel = carPoint(car, vehicleAnchors(car).wheel);
  assert.deepEqual(carPoint(car, vehicleAnchors(car).eye), driverEye(car));
  for (const point of before)
    assert.ok(
      point.distanceTo(new T.Vector3(wheel.x, wheel.y, wheel.z)) < 0.26,
      'hand must reach wheel rim'
    );
  b.yaw += 1.2;
  b.pitch = 0.4;
  rig.update(actor, p, b, 0, 0, car);
  actor.group.updateMatrixWorld(true);
  for (let i = 0; i < hands.length; i++)
    assert.ok(
      hands[i].getWorldPosition(new T.Vector3()).distanceTo(before[i]) < 0.001,
      'look must not move steering grip'
    );
  car.steering = 0.45;
  rig.update(actor, p, b, 0, 0, car);
  actor.group.updateMatrixWorld(true);
  for (let i = 0; i < hands.length; i++) {
    const steered = hands[i].getWorldPosition(new T.Vector3());
    assert.ok(steered.distanceTo(before[i]) > 0.05, 'hand follows steering');
    assert.ok(
      steered.distanceTo(new T.Vector3(wheel.x, wheel.y, wheel.z)) < 0.26,
      'steering keeps hand at rim'
    );
  }
  rig.dispose();
});
