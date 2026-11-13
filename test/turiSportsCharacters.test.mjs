import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const { outputFiles } = await build({
  stdin: {
    contents: `
      export * as THREE from 'three';
      export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
      export { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
      export { bindTuriAthlete, dressAthlete, poseAthlete } from './games/tennis/athlete';
      export { athleteUrl } from './games/tennis/assetLoader';
      export { bindHuman, applyHumanPose, humanPose } from './games/tabletennis/animation';
      export { CHARACTERS, ownedAppearance } from './games/tabletennis/options';
      export { createMatch as createTennisMatch } from './games/tennis/engine';
      export { createMatch as createTableMatch } from './games/tabletennis/engine';
    `,
    resolveDir: new URL('../webapp/src/', import.meta.url).pathname,
    loader: 'ts'
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm'
});
const api = await import(
  'data:text/javascript;base64,' +
    Buffer.from(outputFiles[0].text).toString('base64')
);
const { THREE: T } = api;
const bytes = readFileSync(
  new URL(
    '../webapp/public/assets/tirana-streets/players/turi.glb',
    import.meta.url
  )
);
const loader = new api.GLTFLoader();
// Parse the shipped GLB geometry, skin and materials; only browser image decoding is stubbed.
loader.register(() => ({
  name: 'HEADLESS_TEXTURES',
  loadTexture: async () => new T.Texture()
}));
const source = (
  await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ''
  )
).scene;

test('Turi is a free table tennis choice once and Tennis follows either local seat', () => {
  assert.equal(api.CHARACTERS[0].id, 'turi');
  assert.deepEqual(api.CHARACTERS[0].urls, [
    '/assets/tirana-streets/players/turi.glb'
  ]);
  assert.equal(
    api.ownedAppearance().characters.filter((c) => c.id === 'turi').length,
    1
  );
  for (const seat of [0, 1]) {
    assert.equal(
      api.athleteUrl(seat, seat),
      '/assets/tirana-streets/players/turi.glb'
    );
    assert.match(api.athleteUrl(1 - seat, seat), /athlete-(male|female)\.glb$/);
  }
});

test('Tennis binds the actual Turi skin without changing original materials or geometry', () => {
  const model = api.clone(source),
    surfaces = [];
  model.traverse((o) => {
    if (o.isMesh) surfaces.push([o, o.geometry, o.material]);
  });
  const rig = api.dressAthlete(model, 0, true);
  assert.equal(rig.authored, true);
  for (const [mesh, geometry, material] of surfaces) {
    assert.equal(mesh.geometry, geometry);
    assert.equal(mesh.material, material);
  }
  const bounds = new T.Box3().setFromObject(model);
  assert.ok(Math.abs(bounds.getSize(new T.Vector3()).y - 1.75) < 0.001);
  for (const key of [
    'upperarm_l',
    'lowerarm_l',
    'hand_l',
    'upperarm_r',
    'lowerarm_r',
    'hand_r',
    'thigh_l',
    'calf_l',
    'foot_l',
    'thigh_r',
    'calf_r',
    'foot_r',
    'index_01_r'
  ])
    assert.ok(rig.bones.get(key)?.isBone, key);
});

test('Turi Tennis walking and swing animation keeps the racket on his real wrist without drift', () => {
  for (const seat of [0, 1]) {
    const model = api.clone(source),
      root = new T.Group(),
      racket = new T.Group();
    const rig = api.dressAthlete(model, seat, true);
    root.add(model, racket);
    root.position.set(3, 0, -7);
    root.rotation.y = seat === 0 ? Math.PI : 0;
    const state = api.createTennisMatch({ ai: false });
    state.time = 2;
    state.phase = 'rally';
    state.players[seat].swingAt = 1.8;
    const runPose = () =>
      api.poseAthlete(rig, root, racket, state, seat, 0.8, 3);
    runPose();
    const hand = rig.bones.get('hand_r');
    const expected = hand.getWorldPosition(new T.Vector3());
    root.updateMatrixWorld(true);
    assert.ok(
      racket.getWorldPosition(new T.Vector3()).distanceTo(expected) < 1e-6
    );
    const before = new Map(
      [...rig.rest.keys()].map((b) => [b, b.quaternion.clone()])
    );
    for (let i = 0; i < 20; i++) runPose();
    for (const [bone, quaternion] of before) {
      assert.ok(bone.quaternion.toArray().every(Number.isFinite), bone.name);
      assert.ok(
        bone.quaternion
          .toArray()
          .every((v, i) => Math.abs(v - quaternion.toArray()[i]) < 1e-6),
        bone.name + ' accumulated drift'
      );
    }
  }
});

test('Turi table tennis uses both real arms and puts the paddle handle on the right wrist', () => {
  for (const seat of [0, 1]) {
    const model = api.clone(source),
      root = new T.Group(),
      stage = new T.Group(),
      paddle = new T.Group();
    const bounds = new T.Box3().setFromObject(model);
    const scale = 1.75 / bounds.getSize(new T.Vector3()).y;
    model.scale.multiplyScalar(scale);
    model.position.y = -bounds.min.y * scale;
    const state = api.createTableMatch({ ai: false });
    state.phase = 'point';
    state.time = 3;
    root.position.set(state.players[seat].x, 0, state.players[seat].z);
    root.rotation.y = seat === 0 ? Math.PI : 0;
    stage.add(root, paddle);
    root.add(model);
    stage.updateMatrixWorld(true);
    const rig = api.bindHuman(model);
    assert.ok(rig.right && rig.left);
    const pose = api.humanPose(state, seat, root.rotation.y);
    api.applyHumanPose(rig, pose, stage, root, paddle);
    stage.updateMatrixWorld(true);
    const handle = paddle.localToWorld(new T.Vector3(0, -0.115, 0));
    const wrist = rig.bones.rightHand.getWorldPosition(new T.Vector3());
    assert.ok(handle.distanceTo(wrist) < 1e-6);
    for (const bone of Object.values(rig.bones))
      assert.ok(bone.quaternion.toArray().every(Number.isFinite));
  }
});
