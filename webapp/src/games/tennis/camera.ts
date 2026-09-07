import * as THREE from 'three';
import { side, type Seat } from './engine';

/** Low third-person view. Translation follows the player without reversing the
 * screen axes or shaking the view as they take individual steps. */
export function playerCamera(
  camera: THREE.PerspectiveCamera,
  seat: Seat,
  player: { x: number; z: number },
  dt = 1
) {
  camera.up.set(0, 1, 0);
  camera.fov = 64;
  const sign = side(seat);
  const target = new THREE.Vector3(
    player.x * 0.55,
    4.8,
    sign * (Math.max(8.5, Math.min(13.3, Math.abs(player.z))) + 8.2)
  );
  camera.position.lerp(target, 1 - Math.exp(-dt * 4.5));
  camera.lookAt(camera.position.x, 1, camera.position.z - sign * 22);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

/** Invert the projection's local Jacobian, preserving all four screen directions
 * and diagonal angles. Pixels are normalized uniformly, not per-axis. */
export function fingerDirection(
  camera: THREE.PerspectiveCamera,
  anchor: { x: number; y: number; z: number },
  dx: number,
  dy: number
) {
  if (Math.hypot(dx, dy) < 0.001) return null;
  const p = new THREE.Vector3(anchor.x, anchor.y, anchor.z).project(camera);
  const px = new THREE.Vector3(anchor.x + 0.001, anchor.y, anchor.z).project(
    camera
  );
  const pz = new THREE.Vector3(anchor.x, anchor.y, anchor.z + 0.001).project(
    camera
  );
  const a = (px.x - p.x) * camera.aspect,
    b = (pz.x - p.x) * camera.aspect;
  const c = -(px.y - p.y),
    d = -(pz.y - p.y);
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-12) return null;
  const x = (dx * d - b * dy) / determinant,
    z = (a * dy - dx * c) / determinant;
  const length = Math.hypot(x, z);
  return { x: x / length, z: z / length };
}
