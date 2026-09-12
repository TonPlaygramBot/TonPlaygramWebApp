import * as THREE from 'three';
import { side, type Seat } from './engine';

/** Match Table Tennis Royal's eye-level lens and short player offset. Widen the
 * vertical lens on portrait screens; never pull the camera up or away to fit.
 * Follow the displayed player's position directly so the hands cannot drift
 * through the camera during movement or online interpolation. */
export function playerCamera(
  camera: THREE.PerspectiveCamera,
  seat: Seat,
  player: { x: number; z: number }
) {
  camera.up.set(0, 1, 0);
  camera.fov = THREE.MathUtils.radToDeg(
    2 *
      Math.atan(
        Math.tan(THREE.MathUtils.degToRad(58 / 2)) / Math.min(1, camera.aspect)
      )
  );
  camera.near = 0.06;
  const sign = side(seat);
  camera.position.set(player.x, 1.62, player.z + sign * 0.32);
  // Table tennis looks down 0.70 m over 2.42 m in its ready stance. Preserve
  // that viewing angle on the larger court, keeping the hands at the bottom.
  const gazeX = player.x * 0.22;
  const gazeZ = -sign * 0.4;
  const gazeDistance = Math.hypot(
    gazeX - camera.position.x,
    gazeZ - camera.position.z
  );
  camera.lookAt(gazeX, 1.62 - gazeDistance * (0.7 / 2.42), gazeZ);
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
