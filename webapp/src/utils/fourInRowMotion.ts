import type { Group, Vector3 } from 'three';

export type FourInRowDrop = {
  mesh: Group;
  columnTop: Vector3;
  target: Vector3;
  elapsed: number;
  phase: 'preview' | 'drop' | 'settle';
  previewDuration: number;
  dropDuration: number;
  bounceHeight: number;
};

const SETTLE_DURATION = 0.16;

// Accumulate skipped frames: a 120/144 Hz display must still animate with a
// 50/60 Hz graphics preset. Reading and discarding every short delta freezes it.
export function consumeFourInRowFrame(clock: { pending: number }, delta: number, fps: number) {
  clock.pending += Math.max(0, Math.min(delta, 0.1));
  const budget = 1 / Math.max(30, fps || 60);
  if (clock.pending + 1e-6 < budget) return 0;
  const elapsed = clock.pending;
  clock.pending = 0;
  return elapsed;
}

export function getFourInRowDropDuration(distanceInRows: number) {
  return 0.18 + Math.sqrt(Math.max(0, distanceInRows)) * 0.115;
}

// The chip accelerates down the column, makes contact once, then settles above
// its target. Carry phase overflow forward so timing is stable across displays.
export function advanceFourInRowDrop(entry: FourInRowDrop, delta: number) {
  entry.elapsed += Math.max(0, delta);
  let landed = false;
  const { mesh } = entry;
  mesh.visible = true;
  if (entry.phase === 'preview') {
    mesh.position.copy(entry.columnTop);
    if (entry.elapsed < entry.previewDuration) return { landed, finished: false };
    entry.elapsed -= entry.previewDuration;
    entry.phase = 'drop';
  }
  if (entry.phase === 'drop') {
    const t = Math.min(1, entry.elapsed / entry.dropDuration);
    mesh.position.lerpVectors(entry.columnTop, entry.target, t * t);
    mesh.rotation.x = Math.PI / 2 + Math.sin(t * Math.PI) * 0.055;
    mesh.rotation.z = Math.sin(t * Math.PI) * 0.11;
    if (t < 1) return { landed, finished: false };
    entry.elapsed -= entry.dropDuration;
    entry.phase = 'settle';
    landed = true;
  }
  const t = Math.min(1, entry.elapsed / SETTLE_DURATION);
  const bounce = Math.sin(t * Math.PI) * (1 - t) ** 2;
  mesh.position.copy(entry.target);
  mesh.position.y += entry.bounceHeight * bounce;
  mesh.scale.set(1 + bounce * 0.035, 1 - bounce * 0.04, 1);
  mesh.rotation.x = Math.PI / 2;
  mesh.rotation.z = Math.sin(t * Math.PI * 2) * (1 - t) * 0.025;
  if (t < 1) return { landed, finished: false };
  mesh.position.copy(entry.target);
  mesh.rotation.set(Math.PI / 2, 0, 0);
  mesh.scale.setScalar(1);
  return { landed, finished: true };
}
