import * as T from 'three';
import { WEAPON_CALIBRATIONS } from './shared/weaponCalibration.mjs';

/** Normalize the actual visible barrel, preserving the glTF's root transforms.
 * A single coordinate system supplies held models, NPC models and muzzle FX. */
export function calibrateWeaponModel(source: T.Group, url: string, length: number) {
  const name = url.split('/').pop()!;
  const calibration = WEAPON_CALIBRATIONS[name as keyof typeof WEAPON_CALIBRATIONS];
  if (!calibration) throw Error(`Missing weapon calibration: ${name}`);
  const frame = new T.Group();
  frame.add(source);
  const forward = new T.Vector3().fromArray(calibration.forward).normalize();
  const right = new T.Vector3().fromArray(calibration.up).cross(forward).normalize();
  const up = new T.Vector3().crossVectors(forward, right).normalize();
  const rotation = new T.Matrix4().makeBasis(right, up, forward).transpose();
  const base = new T.Matrix4().makeRotationFromEuler(new T.Euler(...calibration.base as [number,number,number]));
  frame.quaternion.setFromRotationMatrix(rotation.multiply(base));
  frame.updateMatrixWorld(true);
  const points: T.Vector3[] = [];
  frame.traverseVisible(o => {
    if (!(o instanceof T.Mesh)) return;
    const positions = o.geometry.getAttribute('position');
    for (let i=0;i<positions.count;i++) points.push(new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld));
  });
  const bounds = new T.Box3().setFromPoints(points), extent = bounds.max.z-bounds.min.z;
  if (!Number.isFinite(extent) || extent<.0001) throw Error('Invalid weapon geometry');
  // The front cap, excluding the receiver, magazine and rear stock.
  const cap = new T.Box3().setFromPoints(points.filter(p=>p.z>=bounds.max.z-extent*.008));
  const muzzle = cap.getCenter(new T.Vector3());
  const scale = length/extent;
  frame.scale.setScalar(scale);
  frame.position.set(-muzzle.x*scale, .045-muzzle.y*scale, length*.72-bounds.max.z*scale);
  const result = new T.Group(); result.add(frame);
  return result;
}

export function hideAuthoredWeaponHands(source: T.Group, url: string) {
  // This source includes a separate pair of skinned arms; the player's rig owns arms.
  if (/\/(?:shotgun\.glb|fpsGunAttack\.gltf)$/.test(url))
    source.traverse(o=>{ if(o instanceof T.SkinnedMesh) o.visible=false; });
}
