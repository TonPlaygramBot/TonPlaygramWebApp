import * as THREE from 'three';
import { fingerDirection } from '../tennis/camera';

export const SCENE_SCALE = { playerHeight: 1.75 };
export function tableCamera(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  player = { x: 0, z: 1.7 }
) {
  camera.aspect = width / height;
  // Eye height remains human-sized. Widen the vertical lens on portrait screens
  // instead of moving the player several metres away from their table.
  camera.fov = THREE.MathUtils.radToDeg(
    2 *
      Math.atan(
        Math.tan(THREE.MathUtils.degToRad(58 / 2)) / Math.min(1, camera.aspect)
      )
  );
  camera.up.set(0, 1, 0);
  camera.near = 0.06;
  camera.position.set(player.x, 1.62, player.z + 0.32);
  camera.lookAt(player.x * 0.22, 0.92, -0.4);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
export function tableFingerDirection(
  camera: THREE.PerspectiveCamera,
  stage: THREE.Group,
  anchor: { x: number; y: number; z: number },
  dx: number,
  dy: number
) {
  stage.updateWorldMatrix(true, false);
  const world = stage.localToWorld(
    new THREE.Vector3(anchor.x, anchor.y, anchor.z)
  );
  const heading = fingerDirection(camera, world, dx, dy);
  if (!heading) return null;
  const local = new THREE.Vector3(heading.x, 0, heading.z).transformDirection(
    stage.matrixWorld.clone().invert()
  );
  const norm = Math.hypot(local.x, local.z);
  return { x: local.x / norm, z: local.z / norm };
}
/** Pixel-to-floor displacement in the actual displayed camera, for dragging the player. */
export function tableFingerOffset(
  camera: THREE.PerspectiveCamera,
  stage: THREE.Group,
  anchor: { x: number; y: number; z: number },
  dx: number,
  dy: number,
  width: number,
  height: number,
  player = { x: 0, z: 1.7 }
) {
  stage.updateWorldMatrix(true, false);
  const project = (x: number, z: number) =>
    stage.localToWorld(new THREE.Vector3(x, anchor.y, z)).project(camera);
  const p = project(anchor.x, anchor.z),
    px = project(anchor.x + 0.001, anchor.z),
    pz = project(anchor.x, anchor.z + 0.001);
  const a = ((px.x - p.x) * width) / 2,
    b = ((pz.x - p.x) * width) / 2,
    c = (-(px.y - p.y) * height) / 2,
    d = (-(pz.y - p.y) * height) / 2;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-12) return { x: 0, z: 0 };
  return {
    x: ((dx * d - b * dy) / determinant) * 0.001,
    z: ((a * dy - dx * c) / determinant) * 0.001
  };
}
