import * as THREE from 'three';
import { side, type Seat } from './engine';

export const CAMERA_VIEWS = {
  close: 'Close',
  eyes: 'POV',
  wide: 'Wide'
} as const;
export type CameraView = keyof typeof CAMERA_VIEWS;

/** All views face the opposite baseline from the local player's end. */
export function playerCamera(
  camera: THREE.PerspectiveCamera,
  seat: Seat,
  player: { x: number; z: number },
  dt = 1,
  view: CameraView = 'close'
) {
  camera.up.set(0, 1, 0);
  const sign = side(seat);
  const fov = view === 'eyes' ? 72 : view === 'wide' ? 55 : 64;
  const blend = 1 - Math.exp(-dt * 5.5);
  if (view === 'eyes') {
    // Follow the rendered player's position at eye height, without head bob.
    camera.position.set(player.x, 1.66, player.z - sign * 0.16);
    camera.lookAt(player.x, 0.95, camera.position.z - sign * 12);
  } else if (view === 'wide') {
    camera.position.set(0, 14, sign * (camera.aspect < 0.85 ? 25 : 22));
    camera.lookAt(0, 0, 0);
  } else {
    const depth = Math.max(7, Math.abs(player.z)) + 6.1;
    camera.position.x += (player.x * 0.68 - camera.position.x) * blend;
    camera.position.y += (3.9 - camera.position.y) * blend;
    camera.position.z += (sign * depth - camera.position.z) * blend;
    camera.lookAt(camera.position.x, 0.8, camera.position.z - sign * 16);
  }
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
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
