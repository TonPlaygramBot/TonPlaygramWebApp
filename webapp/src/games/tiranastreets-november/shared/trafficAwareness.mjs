const finite = value => Number.isFinite(value) ? value : 0;

/** Heading uses the same -Z nose convention as vehicles and walking actors. */
export function actorVelocity(actor) {
  const speed = finite(actor.speed), heading = finite(actor.heading);
  return {x: Number.isFinite(actor.vx) ? actor.vx : -Math.sin(heading) * speed,
    z: Number.isFinite(actor.vz) ? actor.vz : -Math.cos(heading) * speed};
}

/** Continuous relative sweep against the oriented vehicle footprint. Unlike
 * sampled positions, this catches a fast car between two prediction instants. */
export function sweptVehicleConflict(car, actor, velocity, halfWidth, halfLength, horizon = 1.8) {
  const heading = finite(car.heading), fx = -Math.sin(heading), fz = -Math.cos(heading);
  const dx = actor.x - car.x, dz = actor.z - car.z, c = actorVelocity(car);
  const vx = velocity.x - c.x, vz = velocity.z - c.z;
  let enter = 0, leave = Math.max(0, horizon);
  for (const [position, speed, extent] of [
    [dx * fx + dz * fz, vx * fx + vz * fz, halfLength],
    [dx * fz - dz * fx, vx * fz - vz * fx, halfWidth]
  ]) {
    if (Math.abs(speed) < 1e-6) {
      if (Math.abs(position) > extent) return false;
      continue;
    }
    const a = (-extent - position) / speed, b = (extent - position) / speed;
    enter = Math.max(enter, Math.min(a, b));
    leave = Math.min(leave, Math.max(a, b));
    if (leave < enter) return false;
  }
  return leave >= enter;
}

/** A parked or wrecked body is an obstacle to walk around, not a driver whose
 * right of way can clear. Moving traffic, even briefly stopped, keeps priority. */
export function parkedVehicleObstacle(car) {
  const velocity = actorVelocity(car);
  return Math.hypot(velocity.x, velocity.z) < .25 &&
    (car.destroyed || car.burning || !car.driver && !car.npcDriver);
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
