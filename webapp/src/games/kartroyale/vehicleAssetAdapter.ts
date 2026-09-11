import * as T from 'three';
import {
  MILITARY_ASSETS,
  normaliseVehicleDimensions,
  vehicleTargetLength,
  vehicleDriverMount,
  type VehicleFit
} from './vehicleAssetConfig.mjs';
/** Exported GLBs stay in metres; this adapter alone scales each visual, cockpit
 * mount and wheel radius. Road vehicles use real-world lengths while the
 * original racing karts retain their compact 2.7-unit footprint. */
export function prepareVehicleAsset(
  scene: T.Group,
  id: string,
  referenceFit?: VehicleFit
) {
  // The restored Three.js Ferrari is authored across X; turn its nose into the
  // race's +Z-forward convention before measuring or placing it.
  if (id === 'ferrari') scene.rotation.y = Math.PI / 2;
  const bounds = new T.Box3().setFromObject(scene);
  const fit =
    referenceFit ||
    normaliseVehicleDimensions({
      min: bounds.min.toArray(),
      max: bounds.max.toArray()
    }, vehicleTargetLength(id));
  // Existing Kenney karts retain their original horizontal authoring origin.
  if (!MILITARY_ASSETS[id] && id !== 'ferrari') fit.offset = [0, fit.offset[1], 0];
  scene.scale.setScalar(fit.scale);
  scene.position.set(...(fit.offset as [number, number, number]));
  scene.userData.vehicleFit = fit;
  if (MILITARY_ASSETS[id]) {
    scene.userData.driverEye = vehicleDriverMount(id, fit);
    scene.userData.wheelRadius = MILITARY_ASSETS[id].wheelRadius * fit.scale;
    scene.userData.factoryFinish = true;
  }
  scene.updateMatrixWorld(true);
  return scene;
}
