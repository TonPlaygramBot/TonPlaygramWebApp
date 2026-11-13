// @vitest-environment node
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createRider, poseRider } from './rider';
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
  for (const steer of [-1, 0, 1]) {
    hull.position.set(31, 2, 15);
    hull.rotation.set(0.12, 1.3, steer * 0.3);
    poseRider(rig, hull, steer, 30, 3, true);
    hull.updateMatrixWorld(true);
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
