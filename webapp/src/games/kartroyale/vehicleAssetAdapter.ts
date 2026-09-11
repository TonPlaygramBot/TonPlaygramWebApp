import { ALBANIAN_FORCES_ASSETS } from './albanianForcesCatalog.mjs';
import * as T from 'three';
import {
  MILITARY_ASSETS,
  normaliseVehicleDimensions,
  vehicleDriverMount,
  type VehicleFit
} from './vehicleAssetConfig.mjs';
/** The race keeps its existing 2.7-unit kart footprint. Exported GLBs stay in
 * metres; this adapter alone scales the visual, cockpit mount and wheel radius. */
export function prepareVehicleAsset(
  scene: T.Group,
  id: string,
  referenceFit?: VehicleFit
) {
  const forces = ALBANIAN_FORCES_ASSETS[id];
  if (forces) {
    // Preserve local wheel pivots beneath the orientation wrapper.
    const oriented = new T.Group();
    oriented.name = 'forces-body';
    scene.rotation.y = -Math.PI / 2;
    oriented.add(scene);
    scene = new T.Group();
    scene.add(oriented);
  }
  const bounds = new T.Box3().setFromObject(scene);
  const fit =
    referenceFit ||
    normaliseVehicleDimensions({
      min: bounds.min.toArray(),
      max: bounds.max.toArray()
    });
  // Existing Kenney karts retain their original horizontal authoring origin.
  if (!MILITARY_ASSETS[id] && !forces) fit.offset = [0, fit.offset[1], 0];
  scene.scale.setScalar(fit.scale);
  scene.position.set(...(fit.offset as [number, number, number]));
  scene.userData.vehicleFit = fit;
  if (MILITARY_ASSETS[id] || forces) {
    scene.userData.driverEye = vehicleDriverMount(id, fit);
    scene.userData.wheelRadius =
      (forces || MILITARY_ASSETS[id]).wheelRadius * fit.scale;
    scene.userData.factoryFinish = true;
  }
  scene.updateMatrixWorld(true);
  return scene;
}
