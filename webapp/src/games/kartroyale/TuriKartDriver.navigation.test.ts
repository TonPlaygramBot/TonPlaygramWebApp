// @vitest-environment node
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TuriKartDriver } from './TuriKartDriver';
import { driverPose } from './driverPose.mjs';
import { humanoidPalmPoint } from '../tiranastreets/street-career/humanoidHands.mjs';

it.each([[false, 1], [true, 1], [false, 2 / 2.7], [true, 2 / 2.7]] as const)(
  'Turi keeps adult stature and moving control contacts (raised %s, fit %s)',
  async (raised, fitScale) => {
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
    const driver = new TuriKartDriver(source.scene, '#ff0000', raised),
      hull = new T.Group();
    hull.add(driver.root);
    hull.scale.setScalar(fitScale);
    driver.update({ steering: 0, acceleration: 0, yawRate: 0, speed: 0, throttle: 0, braking: false } as any, 0, false, true);
    hull.updateMatrixWorld(true);
    expect(driver.root.getWorldScale(new T.Vector3()).y).toBeCloseTo(1, 6);
    const garagePose = driverPose(0, 0, 0, 0, 0, true);
    expect(
      driver.bones
        .get('leftfoot')!
        .getWorldPosition(new T.Vector3())
        .distanceTo(
          driver.root.localToWorld(new T.Vector3(...garagePose.legs.l.ankle).multiplyScalar(fitScale))
        )
    ).toBeLessThan(0.012);
    const materialNames = new Set<string>();
    driver.root.traverse((o) => {
      if (o instanceof T.Mesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materialNames.add(m.name);
    });
    expect(materialNames.has('Turi multi-view head')).toBe(true);
    expect(materialNames.has('model')).toBe(true);
    for (const yaw of [0, 1.2, -2])
      for (const steer of [-1, 0, 1]) {
        hull.position.set(12, 2, -3);
        hull.rotation.set(0.1, yaw, 0.08);
        const racer = {
          steering: steer,
          acceleration: 8,
          yawRate: 1.2,
          speed: 30,
          throttle: 1,
          braking: false
        } as any;
        driver.update(racer, 3, false, false);
        hull.updateMatrixWorld(true);
        const pose = driverPose(steer, 8, 1.2, 30, 3, false, { throttle: 1 });
        for (const [side, key] of [
          ['left', 'l'],
          ['right', 'r']
        ] as const) {
          expect(
            humanoidPalmPoint(driver.bones, side).distanceTo(
              driver.root.localToWorld(new T.Vector3(...pose.arms[key].hand).multiplyScalar(fitScale))
            )
          ).toBeLessThan(0.012);
          expect(
            driver.bones
              .get(side + 'foot')!
              .getWorldPosition(new T.Vector3())
              .distanceTo(
                driver.root.localToWorld(new T.Vector3(...pose.legs[key].ankle).multiplyScalar(fitScale))
              )
          ).toBeLessThan(0.012);
        }
      }
    const geometryBefore = new Map<T.Mesh, T.BufferGeometry>();
    source.scene.traverse((o) => {
      if (o instanceof T.Mesh) geometryBefore.set(o, o.geometry);
    });
    const racer = {
      steering: 0,
      acceleration: 0,
      yawRate: 0,
      speed: 0,
      throttle: 0,
      braking: false
    } as any;
    driver.update(racer, 4, true, true);
    driver.update(racer, 4, false, true);
    for (const [mesh, geometry] of geometryBefore)
      expect(mesh.geometry).toBe(geometry);
    driver.dispose();
    driver.dispose();
  }
);
