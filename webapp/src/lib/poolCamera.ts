import * as THREE from 'three';
import { clamp } from './poolMath';

const tmpUp = new THREE.Vector3();
const tmpAxis = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const fallbackAxis = new THREE.Vector3(1, 0, 0);
const cameraUp = new THREE.Vector3(0, 1, 0);

export function alignCueRollToUp(
  object: THREE.Object3D,
  up: THREE.Vector3,
  lerp: number,
): void {
  tmpUp.set(0, 1, 0).applyQuaternion(object.quaternion);
  const dot = clamp(tmpUp.dot(up), -1, 1);
  const angle = Math.acos(dot);
  if (angle < 1e-5) return;

  tmpAxis.copy(tmpUp).cross(up);
  if (tmpAxis.lengthSq() < 1e-8) {
    tmpAxis.copy(fallbackAxis).applyQuaternion(object.quaternion).cross(up);
    if (tmpAxis.lengthSq() < 1e-8) {
      tmpAxis.copy(cameraUp);
    }
  }
  tmpAxis.normalize();
  const clampedLerp = clamp(lerp, 0, 1);
  if (clampedLerp <= 0) return;
  tmpQuat.setFromAxisAngle(tmpAxis, angle * clampedLerp);
  object.quaternion.premultiply(tmpQuat);
}

export * from './poolMath';
