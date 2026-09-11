import {RegionalPanorama} from '../tirana-region/RegionalPanorama';
import * as T from 'three';
import { InstitutionLayer } from '../tirana-city-source/InstitutionLayer';
import { INSTITUTION_BUILDING_IDS } from '../tirana-city-source/registry.mjs';
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
import { UrbanLifeLayer } from './UrbanLifeLayer';
import {StreetLifeLayer} from '../tirana-street-life/StreetLifeLayer';
import {MatureTreeLayer} from '../tirana-street-life/MatureTreeLayer';
import {REAL_STOREFRONT_BUILDING_IDS,FUEL_CANOPY_IDS} from '../tirana-street-life/registry.mjs';
export {
  disposeTree,
  originalAsset,
  CivicDetails,
  DajtiLayer
} from './BaseWorldEnhancements';
/** One shared street-detail integration, using the unchanged city metre frame. */
export class WorldEnhancements extends ExistingEnhancements {
  readonly panorama = new RegionalPanorama();
  private panoramaViewer = new T.Vector3();
  readonly shopfronts = new ShopfrontDetails(
    WORLD,
    new Set([...CIVIC_SITES.map((s) => s.way), ...INSTITUTION_BUILDING_IDS, ...REAL_STOREFRONT_BUILDING_IDS, ...FUEL_CANOPY_IDS]),
    this.civic.errors
  );
  readonly institutions = new InstitutionLayer(undefined, this.civic.errors);
  readonly streets: StreetDetailLayer;
  readonly ground: GroundDetailLayer;
  readonly attractions = new ParkAttractions(WORLD);
  readonly urbanLife = new UrbanLifeLayer();
  readonly streetLife: StreetLifeLayer;
  readonly matureTrees: MatureTreeLayer;
  constructor(options: StreetDetailOptions = {}) {
    super();
    this.streetLife=new StreetLifeLayer(undefined,options);
    this.matureTrees=new MatureTreeLayer(undefined,options);
    // Photo-informed full façades now replace these three generic bay kits.
    if (options.profile !== "racing") {
      this.civic.retire();
      this.civic.group.visible = false;
    }
    this.ground = new GroundDetailLayer(WORLD, options, this.civic.errors);
    this.group.add(this.ground.group, this.panorama.group);
    this.streets = new StreetDetailLayer(
      WORLD,
      STREET_DETAILS,
      this.civic.errors,
      options
    );
    this.group.add(
      this.institutions.group,
      this.shopfronts.group,
      this.streets.group,
      this.attractions.group,
      this.urbanLife.group,
      this.streetLife.group,
      this.matureTrees.group
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
    if(camera){
      this.group.updateWorldMatrix(true,false);
      camera.getWorldPosition(this.panoramaViewer);
      this.group.worldToLocal(this.panoramaViewer);
      this.panorama.update(this.panoramaViewer,camera);
    }
    let viewer = worldViewer;
    if (!viewer && camera) {
      this.group.updateWorldMatrix(true, false);
      const p = this.group.worldToLocal(
        camera.getWorldPosition(new T.Vector3())
      );
      viewer = { x: p.x, z: p.z };
    }
    this.institutions.update(seconds, viewer, battery);
    this.shopfronts.update(seconds, viewer, battery);
    this.streets.update(seconds, viewer, battery);
    this.ground.update(viewer, battery);
    this.attractions.update(seconds, viewer, battery);
    this.urbanLife.update(seconds, viewer, battery);
    this.streetLife.update(seconds,viewer,battery);
    this.matureTrees.update(seconds,viewer,battery);
  }
  override retire() {
    this.institutions.retire();
    this.ground.retire();
    this.streets.retire();
    this.shopfronts.retire();
    this.urbanLife.retire();
    this.streetLife.retire();
    this.matureTrees.retire();
    super.retire();
  }
  override dispose() {
    this.panorama.dispose();
    this.institutions.dispose();
    this.attractions.dispose();
    this.ground.dispose();
    this.streets.dispose();
    this.shopfronts.dispose();
    this.urbanLife.dispose();
    this.streetLife.dispose();
    this.matureTrees.dispose();
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
