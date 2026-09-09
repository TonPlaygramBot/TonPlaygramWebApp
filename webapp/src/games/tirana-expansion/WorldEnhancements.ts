import * as T from 'three';
import { GroundDetailLayer } from '../tirana-environment/GroundDetailLayer';
import { WorldEnhancements as ExistingEnhancements } from './BaseWorldEnhancements';
import { ShopfrontDetails } from '../tirana-region/ShopfrontDetails';
import { WORLD } from '../tiranastreets/shared/world.mjs';
import { CIVIC_SITES } from './geography.mjs';
import {
  StreetDetailLayer,
  type StreetDetailOptions
} from '../tirana-street-detail/StreetDetailLayer';
import { STREET_DETAILS } from '../tirana-street-detail/sharedRoadDetails.mjs';
import { ParkAttractions } from '../tirana-environment/ParkAttractions';
export {
  disposeTree,
  originalAsset,
  CivicDetails,
  DajtiLayer
} from './BaseWorldEnhancements';
/** One shared street-detail integration, using the unchanged city metre frame. */
export class WorldEnhancements extends ExistingEnhancements {
  readonly shopfronts = new ShopfrontDetails(
    WORLD,
    new Set(CIVIC_SITES.map((s) => s.way)),
    this.civic.errors
  );
  readonly streets: StreetDetailLayer;
  readonly ground: GroundDetailLayer;
  readonly attractions = new ParkAttractions(WORLD);
  constructor(options: StreetDetailOptions = {}) {
    super();
    this.ground = new GroundDetailLayer(WORLD, options, this.civic.errors);
    this.group.add(this.ground.group);
    this.streets = new StreetDetailLayer(
      WORLD,
      STREET_DETAILS,
      this.civic.errors,
      options
    );
    this.group.add(
      this.shopfronts.group,
      this.streets.group,
      this.attractions.group
    );
  }
  bindBuildings(root: T.Object3D, excluded: readonly T.Object3D[] = []) {
    this.streets.bindBuildings(root, [this.group, ...excluded]);
  }
  override update(
    seconds: number,
    camera?: T.PerspectiveCamera,
    worldViewer?: { x: number; z: number },
    battery = false
  ) {
    super.update(seconds, camera);
    let viewer = worldViewer;
    if (!viewer && camera) {
      this.group.updateWorldMatrix(true, false);
      const p = this.group.worldToLocal(
        camera.getWorldPosition(new T.Vector3())
      );
      viewer = { x: p.x, z: p.z };
    }
    this.shopfronts.update(seconds, viewer, battery);
    this.streets.update(seconds, viewer, battery);
    this.ground.update(viewer, battery);
    this.attractions.update(seconds, viewer, battery);
  }
  override retire() {
    this.ground.retire();
    this.streets.retire();
    this.shopfronts.retire();
    super.retire();
  }
  override dispose() {
    this.attractions.dispose();
    this.ground.dispose();
    this.streets.dispose();
    this.shopfronts.dispose();
    super.dispose();
  }
}
const layers = new WeakMap<T.Scene, WorldEnhancements>();
export function attachEnhancements(
  scene: T.Scene,
  origin = { x: 0, z: 0 },
  options: StreetDetailOptions = {}
) {
  const previous = layers.get(scene);
  if (previous) return previous;
  const layer = new WorldEnhancements({
    ...options,
    profile: options.profile || (origin.x || origin.z ? 'fps' : 'street')
  });
  layer.group.position.set(-origin.x, 0, -origin.z);
  scene.add(layer.group);
  layers.set(scene, layer);
  return layer;
}
