import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { gunzipSync } from 'node:zlib';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createMatch, side } from '../shared/tennis/engine.js';

const { outputFiles } = await build({
  stdin: {
    contents: `export * from './firstPerson'; export * from './athlete'; export * from './camera'; export { TennisRenderer } from './render'; export { models } from '../tabletennis/preview/packed'; export * as THREE from 'three'; export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';`,
    resolveDir: new URL('../webapp/src/games/tennis/', import.meta.url).pathname
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false
});
const temp = await mkdtemp(`${tmpdir()}/tennis-eyes-`);
const bundlePath = `${temp}/test-bundle.mjs`;
await writeFile(bundlePath, outputFiles[0].text);
after(async () => {
  await unlink(bundlePath);
  await rmdir(temp);
});
const {
  preparePlayerView,
  showPlayerView,
  disposePlayerView,
  dressAthlete,
  poseAthlete,
  disposeAthlete,
  playerCamera,
  fingerDirection,
  TennisRenderer,
  models,
  THREE,
  GLTFLoader
} = await import(pathToFileURL(bundlePath).href);

test('real tennis athletes show skinned hands locally, restore the full opponent and release cropped geometry', async () => {
  for (const seat of [0, 1]) {
    const raw = gunzipSync(
      Buffer.from(
        models[seat === 0 ? 'athlete-male' : 'athlete-female'],
        'base64'
      )
    );
    // Geometry/rig verification needs no browser image decoder; retain the
    // real GLB skin and meshes while substituting its texture resource only.
    const loader = new GLTFLoader().register(() => ({
      name: 'test-textures',
      loadTexture: () => Promise.resolve(new THREE.Texture())
    }));
    const { scene: model } = await loader.parseAsync(
      raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
      ''
    );
    const rig = dressAthlete(model, seat);
    const parts = preparePlayerView(model);
    const fullCounts = parts.map(
      (part) => part.full.index?.count ?? part.full.attributes.position.count
    );
    showPlayerView(parts, true);
    const visible = parts.filter((part) => part.mesh.visible);
    assert.ok(visible.length, 'Real hands remain visible');
    assert.ok(
      parts.some((part) => !part.mesh.visible && /hair/i.test(part.mesh.name)),
      'Hair is removed from the local view'
    );
    for (const part of visible) {
      assert.ok(part.mesh instanceof THREE.SkinnedMesh);
      assert.equal(part.mesh.geometry, part.hands);
      assert.ok(
        part.hands.index.count > 0 &&
          part.hands.index.count < part.full.index.count
      );
    }
    const root = new THREE.Group(),
      racket = new THREE.Group();
    root.rotation.y = seat === 0 ? Math.PI : 0;
    root.position.set(0, 0, side(seat) * 12.4);
    root.add(model, racket);
    const state = createMatch({ ai: false });
    state.phase = 'point';
    state.time = 3;
    state.players[seat].z = root.position.z;
    poseAthlete(rig, root, racket, state, seat, 0, 0, true);
    const camera = new THREE.PerspectiveCamera(58, 390 / 460, 0.06, 160);
    playerCamera(camera, seat, root.position);
    root.updateMatrixWorld(true);
    for (const name of ['hand_l', 'hand_r']) {
      const point = rig.bones
        .get(name)
        .getWorldPosition(new THREE.Vector3())
        .project(camera);
      assert.ok(
        Math.abs(point.x) < 1 && Math.abs(point.y) < 1,
        `${name} is inside the portrait lens for seat ${seat}: ${point.toArray()}`
      );
    }
    const hand = rig.bones.get('hand_r').getWorldPosition(new THREE.Vector3());
    const head = racket
      .localToWorld(new THREE.Vector3(0, 0.5, 0))
      .project(camera);
    assert.ok(
      Math.abs(head.x) < 1 && Math.abs(head.y) < 1,
      `Racket head stays in view: ${head.toArray()}`
    );
    assert.ok(
      hand.distanceTo(racket.getWorldPosition(new THREE.Vector3())) < 1e-8,
      'Racket stays attached to the real hand'
    );
    showPlayerView(parts, false);
    for (const [i, part] of parts.entries()) {
      assert.equal(part.mesh.visible, part.visible);
      assert.equal(part.mesh.geometry, part.full);
      assert.equal(
        part.full.index?.count ?? part.full.attributes.position.count,
        fullCounts[i]
      );
    }
    let disposed = 0;
    const cropped = parts.filter((part) => part.hands);
    cropped.forEach((part) =>
      part.hands.addEventListener('dispose', () => disposed++)
    );
    showPlayerView(parts, true);
    disposePlayerView(parts);
    assert.equal(disposed, cropped.length);
    assert.ok(parts.every((part) => part.mesh.geometry === part.full));
    disposeAthlete(model);
  }
});

test('camera follows displayed movement with no chase lag, head bob, or replay orientation left over', () => {
  const camera = new THREE.PerspectiveCamera(50, 320 / 540, 0.06, 160);
  for (const seat of [0, 1]) {
    for (const z of [12.4, 8.5, 3]) {
      camera.up.set(0, 0, -1);
      camera.position.set(9, 1.15, -5);
      playerCamera(camera, seat, { x: 2.7, z: side(seat) * z });
      assert.deepEqual(camera.up.toArray(), [0, 1, 0]);
      assert.equal(camera.position.x, 2.7);
      assert.equal(camera.position.y, 1.62);
      assert.ok(Math.abs(camera.position.z - side(seat) * (z + 0.32)) < 1e-10);
      assert.ok(
        camera.getWorldDirection(new THREE.Vector3()).z * side(seat) < 0
      );
    }
  }
});

test('online swipe projection uses the visible hands even when the next snapshot is behind the camera', () => {
  for (const seat of [0, 1]) {
    const state = createMatch({ ai: false });
    const camera = new THREE.PerspectiveCamera(58, 390 / 460, 0.06, 160);
    const shown = new THREE.Group();
    shown.position.set(2, 0, side(seat) * 10);
    const actors = [null, null];
    actors[seat] = { root: shown };
    playerCamera(camera, seat, shown.position);
    state.players[seat].z = side(seat) * 10.7;
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ]) {
      const expected = fingerDirection(
        camera,
        { x: shown.position.x, y: 1.2, z: shown.position.z },
        dx,
        dy
      );
      const result = TennisRenderer.prototype.shotDirection.call(
        { camera, actors, seat },
        dx,
        dy,
        state
      );
      assert.deepEqual(result, expected);
    }
  }
});
