import { Vector2 } from 'three';

/** Find a legal direct contact or a single-cushion escape using live geometry.
 * `trace` is the table's calcTarget, so pocket openings and cushion faces remain
 * authoritative. This is a contact plan, not a prediction that a pot is safe.
 */
export function findBilliardsAiEscape({ cue, balls, legal, trace, radius,
  limitX, limitY, powerFromDistance }) {
  if (!cue?.active || !cue.pos || typeof legal !== 'function' ||
      typeof trace !== 'function' || typeof powerFromDistance !== 'function' ||
      !(radius > 0) || !(limitX > 0) || !(limitY > 0)) return null;
  const objects = (balls ?? []).filter(ball => ball?.active && ball !== cue &&
    String(ball.id) !== String(cue.id) && Number.isFinite(ball.pos?.x) && Number.isFinite(ball.pos?.y));
  const targets = objects.filter(legal);
  if (!targets.length) return null;
  let best = null;
  const inspect = (direction) => {
    if (!Number.isFinite(direction.x) || !Number.isFinite(direction.y) || direction.lengthSq() < 1e-10) return;
    direction.normalize();
    const first = trace(cue, direction, objects);
    if (!first) return;
    let contact = first;
    let distance = Number.isFinite(first.tHit) ? Math.max(0, first.tHit) : 0;
    let railNormal = null;
    let cushionPoint = null;
    if (!first.targetBall) {
      if (!first.railNormal || !first.impact) return;
      railNormal = new Vector2(first.railNormal.x, first.railNormal.y);
      if (!Number.isFinite(railNormal.x) || !Number.isFinite(railNormal.y) || railNormal.lengthSq() < 1e-10) return;
      railNormal.normalize();
      // A face normal points into the playable field. Reject an outgoing or
      // malformed crossing instead of tracing another hit from outside it.
      if (direction.dot(railNormal) >= -1e-8) return;
      cushionPoint = new Vector2(first.impact.x, first.impact.y);
      const reflected = direction.clone().addScaledVector(railNormal, -2 * direction.dot(railNormal)).normalize();
      const origin = cushionPoint.clone().addScaledVector(railNormal, radius * 0.01);
      contact = trace({ ...cue, pos: origin }, reflected, objects);
      if (!contact) return;
      distance += Number.isFinite(contact.tHit) ? Math.max(0, contact.tHit) : 0;
    }
    const targetBall = contact.targetBall;
    if (!targetBall || !targets.some(target => String(target.id) === String(targetBall.id))) return;
    const power = powerFromDistance(distance + radius * 18);
    if (!Number.isFinite(power) || power <= 0 || power > 1) return;
    const candidate = { type: 'safety', aimDir: direction.clone(), targetBall,
      power, spin: { x: 0, y: 0 }, pocketId: 'SAFETY', pocketCenter: null,
      distance, cueToTarget: distance, viaCushion: Boolean(cushionPoint),
      cushionPoint, railNormal };
    // Prefer the shortest verified contact; equal distances prefer no cushion.
    if (!best || distance < best.distance - radius * 0.01 ||
        (Math.abs(distance - best.distance) <= radius * 0.01 && !candidate.viaCushion && best.viaCushion)) {
      best = candidate;
    }
  };
  for (const target of targets) {
    inspect(new Vector2(target.pos.x - cue.pos.x, target.pos.y - cue.pos.y));
    for (const axis of ['x', 'y']) {
      for (const sign of [-1, 1]) {
        const mirror = new Vector2(target.pos.x, target.pos.y);
        mirror[axis] = sign * (axis === 'x' ? limitX : limitY) * 2 - mirror[axis];
        inspect(mirror.sub(cue.pos));
      }
    }
  }
  return best;
}
