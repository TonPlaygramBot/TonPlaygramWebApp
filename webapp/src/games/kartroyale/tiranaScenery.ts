import * as T from 'three';
import { FpsCity } from '../tiranastreets/FpsCity';
import { WORLD } from '../tiranastreets/shared/world.mjs';
import { RACING_REGION } from '../tiranastreets/shared/racingRegion.mjs';
import type { Track } from './simulation.mjs';
import { polygonContains } from '../tiranastreets/shared/architecture.mjs';
export const inside = polygonContains;
export function occupied(x: number, z: number) {
  return [...WORLD.buildings, ...RACING_REGION.buildings].some((b) =>
    polygonContains(x, z, b.p)
  );
}

/** Racing and FPS use the same mapped buildings, pavements and city assets. */
export class TiranaScenery {
  readonly city: FpsCity;
  readonly group: T.Group;
  private camera = new T.Vector3();
  constructor(_track: Track, loadAssets = true) {
    this.city = new FpsCity(loadAssets, {
      ...WORLD,
      roads: [...WORLD.roads, ...RACING_REGION.roads],
      buildings: [...WORLD.buildings, ...RACING_REGION.buildings],
      bounds: RACING_REGION.bounds
    });
    this.group = this.city.group;
  }
  update(x: number, z: number, performance: boolean, time = 0) {
    this.camera.set(x, 1.4, z);
    this.city.update(this.camera, time, performance);
  }
  dispose() {
    this.city.dispose();
  }
}
