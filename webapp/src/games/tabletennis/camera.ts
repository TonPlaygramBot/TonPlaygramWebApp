import * as THREE from 'three';
import { fingerDirection } from '../tennis/camera';

export const SCENE_SCALE = { playerHeight: 1.75 };
export function tableCamera(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number
) {
  camera.aspect = width / height;
  camera.fov = 49;
  camera.up.set(0, 1, 0);
  camera.position.set(0.65, 3.15, camera.aspect < 0.6 ? 5.7 : 5.25);
  camera.lookAt(0, 0.65, 0);
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
  height: number
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
