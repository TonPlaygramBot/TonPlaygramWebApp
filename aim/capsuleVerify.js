import * as THREE from 'three';

const tmpDiff = new THREE.Vector3();
const tmpU = new THREE.Vector3();
const closest = new THREE.Vector3();

export function verifyCapsuleClear(theta, params) {
  const { C, balls = [], rBall, rShaft, epsilon, L } = params;
  const R = rBall + rShaft + epsilon;
  tmpU.set(Math.cos(theta), 0, Math.sin(theta));
  const offenders = [];
  let minMargin = Infinity;

  for (let i = 0; i < balls.length; i += 1) {
    const pos = balls[i].pos;
    tmpDiff.subVectors(pos, C);
    const proj = tmpDiff.dot(tmpU);
    const clamped = Math.min(0, Math.max(-L, proj));
    closest.copy(tmpU).multiplyScalar(clamped).add(C);
    const dist = pos.distanceTo(closest);
    const margin = dist - R;
    if (margin < minMargin) minMargin = margin;
    if (margin < 0) offenders.push(i);
  }

  return { ok: offenders.length === 0, minMargin, offenders };
}
