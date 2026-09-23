const finite = value => Number.isFinite(value) ? value : 0;

/** Heading uses the same -Z nose convention as vehicles and walking actors. */
export function actorVelocity(actor) {
  if (Number.isFinite(actor.vx) && Number.isFinite(actor.vz)) return {x: actor.vx, z: actor.vz};
  const speed = finite(actor.speed), heading = finite(actor.heading);
  return {x: -Math.sin(heading) * speed, z: -Math.cos(heading) * speed};
}

/** Continuous swept intervals catch a crossing between simulation ticks. The
 * modest horizon prevents yielding to a distant pedestrian on the pavement.
 * This is awareness only: collision geometry remains the authored footprint. */
export function crossingConflict(car, actor, halfWidth, halfLength, horizon = 1.8) {
  const fx = -Math.sin(car.heading), fz = -Math.cos(car.heading);
  const dx = actor.x - car.x, dz = actor.z - car.z;
  const forward = dx * fx + dz * fz, side = dx * fz - dz * fx;
  if (forward <= 0 || forward > 60) return false;
  const a = actorVelocity(actor), c = actorVelocity(car);
  const vx = a.x - c.x, vz = a.z - c.z;
  let enter = 0, leave = horizon;
  for (const [position, velocity, extent] of [
    [forward, vx * fx + vz * fz, halfLength],
    [side, vx * fz - vz * fx, halfWidth],
  ]) {
    if (Math.abs(velocity) < 1e-6) {
      if (Math.abs(position) > extent) return false;
      continue;
    }
    const t0 = (-extent - position) / velocity, t1 = (extent - position) / velocity;
    enter = Math.max(enter, Math.min(t0, t1));
    leave = Math.min(leave, Math.max(t0, t1));
    if (leave < enter) return false;
  }
  return leave >= enter;
}

/** Gentle time headway behind moving queues; no extra acceleration allowance
 * for oncoming/crossing vehicles, signals or people. */
export function followingSpeed(cruise, speed, gap, leaderSpeed = 0) {
  if (!Number.isFinite(gap)) return Math.max(0, finite(cruise));
  if (gap <= 0) return 0;
  const brakingLimit = Math.sqrt(gap * 6 + Math.max(0, leaderSpeed) ** 2);
  const headwayLimit = Math.max(0, leaderSpeed) + (gap - Math.max(2, finite(speed) * 1.1)) * .9;
  return Math.max(0, Math.min(finite(cruise), brakingLimit, Math.max(0, headwayLimit)));
}
