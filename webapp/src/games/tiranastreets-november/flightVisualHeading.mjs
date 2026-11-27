import {Box3,Group,Vector3} from 'three';

/** Both current imported aircraft place their cockpit toward +Z; the game's
 * travel vector, pilot camera and fallback meshes face -Z. Convert only the
 * imported visual, leaving the simulation hull and existing asset intact. */
export function fitImportedFlightVisual(model, length) {
  const visual = new Group();
  visual.rotation.y = Math.PI;
  visual.add(model);
  const bounds = new Box3().setFromObject(visual);
  const size = bounds.getSize(new Vector3());
  visual.scale.setScalar(length / Math.max(size.x, size.y, size.z, .01));
  visual.updateMatrixWorld(true);
  const center = bounds.setFromObject(visual).getCenter(new Vector3());
  visual.position.sub(center);
  visual.updateMatrixWorld(true);
  return visual;
}
