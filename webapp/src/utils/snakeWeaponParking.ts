import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
export const SNAKE_PARKING_GAP = 0.035;
export const SNAKE_PARKING_SURFACE_GAP = 0.002;

/** Visible model geometry only: hidden trails and firing effects are not a footprint. */
export function snakeParkingBounds(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const visit = (object: THREE.Object3D) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      if (mesh.geometry.boundingBox) box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    }
    object.children.filter(child => child.visible).forEach(visit);
  };
  visit(root);
  return box;
}

type ParkingOptions = {
  holders: THREE.Object3D[];
  anchors: THREE.Object3D[];
  center: THREE.Vector3;
  table: { radius: number; surfaceY: number; getOuterRadius?: (direction: THREE.Vector3) => number };
  obstacles?: THREE.Object3D[];
  diceZones?: THREE.Vector3[];
};

/** Park in world space, then convert into the scaled board parent exactly once. */
export function parkSnakeWeapons({ holders, anchors, center, table, obstacles = [], diceZones = [] }: ParkingOptions) {
  const occupied = obstacles.map(snakeParkingBounds).filter(box => !box.isEmpty());
  for (const position of diceZones) {
    occupied.push(new THREE.Box3().setFromCenterAndSize(position, new THREE.Vector3(0.24, 1, 0.24)));
  }
  const overlaps = (box: THREE.Box3) => occupied.some(other =>
    box.min.x < other.max.x + SNAKE_PARKING_GAP && box.max.x > other.min.x - SNAKE_PARKING_GAP &&
    box.min.z < other.max.z + SNAKE_PARKING_GAP && box.max.z > other.min.z - SNAKE_PARKING_GAP);
  const supported = (box: THREE.Box3) => {
    for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) {
      const direction = new THREE.Vector3(x - center.x, 0, z - center.z);
      const distance = direction.length();
      const radius = table.getOuterRadius?.(direction.clone().normalize()) ?? table.radius;
      if (distance > radius - SNAKE_PARKING_GAP) return false;
    }
    return true;
  };
  // Search nearest slots first; stop at the first valid one instead of scanning
  // the whole table for every model on a phone's animation thread.
  const slots: { r: number; side: number; score: number }[] = [];
  for (let r = table.radius * 0.42; r <= table.radius * 0.94; r += 0.025) {
    for (let side = -table.radius * 0.55; side <= table.radius * 0.55; side += 0.035) {
      slots.push({ r, side, score: (r - table.radius * 0.71) ** 2 + side ** 2 * 0.7 });
    }
  }
  slots.sort((a, b) => a.score - b.score);
  const results: { seat: number; box: THREE.Box3; scale: number }[] = [];
  for (const holder of holders) {
    const seat = holder.userData.seatIndex;
    const anchor = anchors[seat];
    if (!anchor || !holder.parent || !holder.children.length) continue;
    const outward = anchor.getWorldPosition(new THREE.Vector3()).sub(center).setY(0).normalize();
    const lateral = new THREE.Vector3(outward.z, 0, -outward.x);
    holder.position.set(0, 0, 0);
    holder.quaternion.setFromAxisAngle(UP, Math.atan2(outward.x, outward.z));
    // Never accumulate a previous fit when an imported model or avatar arrives.
    holder.scale.setScalar(1);
    let chosen: { box: THREE.Box3; delta: THREE.Vector3; score: number; scale: number } | null = null;
    for (const scale of [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]) {
      holder.scale.setScalar(scale);
      const measured = snakeParkingBounds(holder);
      if (measured.isEmpty()) break;
      const middle = measured.getCenter(new THREE.Vector3());
      for (const { r, side, score } of slots) {
        const destination = center.clone().addScaledVector(outward, r).addScaledVector(lateral, side);
        const delta = new THREE.Vector3(destination.x - middle.x,
          table.surfaceY + SNAKE_PARKING_SURFACE_GAP - measured.min.y, destination.z - middle.z);
        const candidate = measured.clone().translate(delta);
        if (supported(candidate) && !overlaps(candidate)) {
          chosen = { box: candidate, delta, score, scale };
          break;
        }
      }
      if (chosen) break;
    }
    if (!chosen) {
      // A corrupt/empty asset is not allowed to leave an intersecting display.
      holder.visible = false;
      holder.userData.parkingUnavailable = true;
      continue;
    }
    if (holder.userData.parkingUnavailable) { holder.visible = true; delete holder.userData.parkingUnavailable; }
    const worldOrigin = holder.getWorldPosition(new THREE.Vector3()).add(chosen.delta);
    holder.position.copy(holder.parent.worldToLocal(worldOrigin));
    holder.updateWorldMatrix(true, true);
    holder.userData.parkingScale = chosen.scale;
    occupied.push(chosen.box);
    results.push({ seat, box: chosen.box, scale: chosen.scale });
  }
  return results;
}
