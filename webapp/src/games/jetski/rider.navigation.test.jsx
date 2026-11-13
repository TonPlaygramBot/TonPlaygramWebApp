// @vitest-environment node
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createRider, poseRider, poseFallingRider } from './rider';
import { humanoidPalmPoint } from '../tiranastreets/street-career/humanoidHands.mjs';
it('the bundled rider reaches the grips and footwells while the hull turns, rolls and jumps', async () => {
  globalThis.ProgressEvent = class {
    constructor(_type, data) {
      Object.assign(this, data);
    }
  };
  const bytes = readFileSync(
      new URL(
        '../../../public/assets/table-tennis/athlete-male.glb',
        import.meta.url
      )
    ),
    n = bytes.readUInt32LE(12),
    json = JSON.parse(bytes.subarray(20, 20 + n)),
    bin = bytes.subarray(28 + n);
  // Geometry/skeleton test: texture decoding is a renderer concern.
  json.buffers = [
    {
      byteLength: bin.length,
      uri: 'data:application/octet-stream;base64,' + bin.toString('base64')
    }
  ];
  json.materials = json.materials.map(() => ({}));
  delete json.textures;
  delete json.images;
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), ''),
    rig = createRider(gltf.scene),
    hull = new T.Group();
  hull.add(rig.root);
  const eye = new T.Vector3();
  const head = rig.bones.get('Head')[0];
  expect(rig.eye.parent).toBe(head);
  for (const steer of [-1, 0, 1]) {
    hull.position.set(31, 2, 15);
    hull.rotation.set(0.12, 1.3, steer * 0.3);
    poseRider(rig, hull, steer, 30, 3, true);
    hull.updateMatrixWorld(true);
    rig.eye.getWorldPosition(eye);
    const eyeLocal = hull.worldToLocal(eye);
    expect(eyeLocal.y).toBeGreaterThan(1.4);
    expect(eyeLocal.y).toBeLessThan(1.95);
    expect(eyeLocal.z).toBeGreaterThan(0.18);
    for (const [suffix, sign] of [
      ['l', 1],
      ['r', -1]
    ]) {
      const hand = rig.bones
          .get(`hand_${suffix}`)[0]
          .getWorldPosition(new T.Vector3()),
        foot = rig.bones
          .get(`foot_${suffix}`)[0]
          .getWorldPosition(new T.Vector3());
      expect(
        hand.distanceTo(
          hull.localToWorld(
            new T.Vector3(sign * 0.37, 1.035, 0.42 + sign * steer * 0.08)
          )
        )
      ).toBeLessThan(0.02);
      expect(
        foot.distanceTo(
          hull.localToWorld(new T.Vector3(sign * 0.4, 0.43, -0.43))
        )
      ).toBeLessThan(0.005);
    }
  }
});

it('Turi uses the original skin and reaches the moving grips and footwells through crashes and remounts', async () => {
  const bytes = readFileSync(
    new URL(
      '../../../public/assets/tirana-streets/players/turi.glb',
      import.meta.url
    )
  );
  const loader = new GLTFLoader();
  loader.register(() => ({
    name: 'HEADLESS_TEXTURES',
    loadTexture: async () => new T.Texture()
  }));
  const source = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ''
  );
  const rig = createRider(source.scene, true),
    hull = new T.Group();
  hull.add(rig.root);
  expect(rig.root.userData.characterId).toBe('turi');
  expect(rig.eye.parent).toBe(rig.bones.get('Head')[0]);
  for (const steer of [-1, 0, 1]) {
    hull.position.set(14, 2, -4);
    hull.rotation.set(0.12, 1.3, steer * 0.3);
    poseFallingRider(rig, 0.5, true);
    poseRider(rig, hull, steer, 30, 3, true);
    hull.updateMatrixWorld(true);
    for (const [side, suffix, sign] of [
      ['left', 'l', 1],
      ['right', 'r', -1]
    ]) {
      const target = hull.localToWorld(
        new T.Vector3(sign * 0.37, 1.035, 0.42 + sign * steer * 0.08)
      );
      expect(
        humanoidPalmPoint(rig.canonical, side).distanceTo(target)
      ).toBeLessThan(0.02);
      const foot = rig.bones
        .get(`foot_${suffix}`)[0]
        .getWorldPosition(new T.Vector3());
      expect(
        foot.distanceTo(
          hull.localToWorld(new T.Vector3(sign * 0.4, 0.43, -0.43))
        )
      ).toBeLessThan(0.01);
    }
    const eye = hull.worldToLocal(rig.eye.getWorldPosition(new T.Vector3()));
    expect(eye.y).toBeGreaterThan(1.2);
    expect(eye.y).toBeLessThan(1.9);
  }
});
