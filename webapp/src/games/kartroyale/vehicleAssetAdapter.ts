import * as T from 'three';
import {
  MILITARY_ASSETS,
  KART_ASSETS,
  normaliseVehicleDimensions,
  vehicleDriverMount,
  type VehicleFit
} from './vehicleAssetConfig.mjs';
import { COLLECTION_BY_ID } from '../tiranastreets/shared/vehicleCollection.mjs';
/** The race uses a consistent road-scale vehicle footprint. Exported GLBs stay in
 * metres; this adapter alone scales the visual, cockpit mount and wheel radius. */
export function prepareVehicleAsset(
  scene: T.Group,
  id: string,
  referenceFit?: VehicleFit
) {
  const collectionVehicle = COLLECTION_BY_ID.get(id);
  if (collectionVehicle) scene.rotation.y = -Math.PI / 2;
  scene.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(scene);
  const fit =
    referenceFit ||
    normaliseVehicleDimensions({
      min: bounds.min.toArray(),
      max: bounds.max.toArray()
    }, collectionVehicle ? Math.min(4.65, collectionVehicle.length) : 3.25);
  // Existing Kenney karts retain their original horizontal authoring origin.
  const config = MILITARY_ASSETS[id] || KART_ASSETS[id];
  if (!config && !['ferrari', 'buggy'].includes(id))
    fit.offset = [0, fit.offset[1], 0];
  scene.scale.setScalar(fit.scale);
  scene.position.set(...(fit.offset as [number, number, number]));
  scene.userData.vehicleFit = fit;
  if (config || collectionVehicle) {
    scene.userData.driverEye = vehicleDriverMount(id, fit);
    if (config) scene.userData.wheelRadius = config.wheelRadius * fit.scale;
    scene.userData.factoryFinish = true;
  }
  scene.updateMatrixWorld(true);
  return scene;
}
