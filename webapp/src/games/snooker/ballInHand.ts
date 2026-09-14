import * as THREE from 'three';

export type PlacementPoint = { x: number; y: number };
export type PlacementBounds = {
  limitX: number; limitY: number; baulkY: number; dRadius: number;
  fullTable: boolean;
};

/** The ball centre must stay on or behind the baulk line and inside the D. */
export function clampBallInHand(point: PlacementPoint, bounds: PlacementBounds): PlacementPoint | null {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null;
  let x = THREE.MathUtils.clamp(point.x, -bounds.limitX, bounds.limitX);
  let y = THREE.MathUtils.clamp(point.y, -bounds.limitY, bounds.limitY);
  if (!bounds.fullTable) {
    y = Math.min(y, bounds.baulkY);
    const distance = Math.hypot(x, y - bounds.baulkY);
    if (distance > bounds.dRadius) {
      const scale = bounds.dRadius / distance;
      x *= scale;
      y = bounds.baulkY + (y - bounds.baulkY) * scale;
    }
  }
  return { x, y };
}

/** Project to the rendered ball-centre plane, including table scale/translation. */
export function projectPointerToSnookerTable(
  client: { clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number },
  camera: THREE.Camera, table: THREE.Object3D, ballY: number
): THREE.Vector2 | null {
  if (!Number.isFinite(client.clientX) || !Number.isFinite(client.clientY) || rect.width <= 0 || rect.height <= 0) return null;
  if (client.clientX < rect.left || client.clientX > rect.left + rect.width ||
      client.clientY < rect.top || client.clientY > rect.top + rect.height) return null;
  table.updateWorldMatrix(true, false);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ballY).applyMatrix4(table.matrixWorld);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(
    (client.clientX - rect.left) / rect.width * 2 - 1,
    1 - (client.clientY - rect.top) / rect.height * 2
  ), camera);
  const hit = ray.ray.intersectPlane(plane, new THREE.Vector3());
  if (!hit) return null;
  table.worldToLocal(hit);
  return new THREE.Vector2(hit.x, hit.z);
}
