import * as T from 'three';
import { ribbonExclusion } from '../tirana-street-detail/roadDetailCore.mjs';
import { FpsCity } from './FpsCity';
import { WORLD } from './shared/world.mjs';
import { BUILDING_PROFILES } from './shared/architecture.mjs';
import { nativeReplacementIds } from '../tirana-landmarks/nativeLocations.mjs';
import { INSTITUTION_BUILDING_IDS } from '../tirana-city-source/registry.mjs';
import { FUEL_CANOPY_IDS } from '../tirana-street-life/fuelCollision.mjs';
import { UrbanDetailLayer } from '../tirana-detail-kit/UrbanDetailLayer';
import type { StreetDetailOptions } from '../tirana-street-detail/StreetDetailLayer';
import { WorldEnhancements } from '../tirana-expansion/WorldEnhancements';

/** Static Tirana, in WORLD metres. Both games instantiate this exact assembly.
 * Game actors, race markers, cameras and collision rules belong to the host. */
export class TiranaCityScene {
  readonly group = new T.Group();
  readonly city: FpsCity;
  readonly enhancements: WorldEnhancements;
  readonly details: UrbanDetailLayer;
  private disposed = false;
  constructor(loadAssets = true, track?: StreetDetailOptions['track']) {
    this.enhancements = new WorldEnhancements({ profile: 'fps', track });
    this.city = new FpsCity(loadAssets, track ? ribbonExclusion(track) : undefined);
    const excluded = new Set([...nativeReplacementIds(WORLD), ...Object.keys(BUILDING_PROFILES), ...INSTITUTION_BUILDING_IDS, ...FUEL_CANOPY_IDS]);
    this.details = new UrbanDetailLayer(WORLD, excluded, { roofsOnly: true });
    this.group.name = 'Shared Tirana Streets city';
    this.group.userData = this.city.group.userData;
    this.group.add(this.city.group, this.enhancements.group, this.details.group);
    this.enhancements.bindBuildings(this.city.group, [this.city.landmarks.group, this.city.referenceFacades.group]);
  }
  update(viewer: T.Vector3, seconds: number, battery: boolean, camera?: T.PerspectiveCamera) {
    if (this.disposed) return;
    this.city.update(viewer, seconds, battery);
    this.enhancements.update(seconds, camera, viewer, battery);
    this.details.update(viewer, battery);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    this.enhancements.dispose();
    this.details.dispose();
    this.city.dispose();
  }
}
