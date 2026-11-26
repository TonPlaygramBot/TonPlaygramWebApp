// Local steering only: routes remain on authored sidewalks and actors retain
// their identity. A fixed neighbor budget bounds work in crowded intersections.
const NEIGHBOR_LIMIT = 12;
const active = n => n.health > 0 && n.motion !== 'drive' && !n.carId && !n.aircraftId;

export function crowdNeighbors(actor, people, radius = 2.4) {
  const closest = [], radiusSq = radius * radius;
  for (const other of people) {
    if (other === actor || !active(other)) continue;
    const distanceSq = (other.x - actor.x) ** 2 + (other.z - actor.z) ** 2;
    if (distanceSq >= radiusSq) continue;
    let index = closest.length;
    while (index > 0 && (distanceSq < closest[index - 1].distanceSq ||
      distanceSq === closest[index - 1].distanceSq && String(other.id) < String(closest[index - 1].actor.id))) index--;
    if (index >= NEIGHBOR_LIMIT) continue;
    closest.splice(index, 0, { actor: other, distanceSq });
    if (closest.length > NEIGHBOR_LIMIT) closest.pop();
  }
  return closest;
}

/** Passing stays on a short local waypoint. Moving the distant route endpoint
 * barely changed heading and left two opposing walkers stopped forever. */
export function crowdSteering(actor, goal, speed, neighbors) {
  if (!(speed > 0) || !neighbors.length) return { goal, speed };
  const dx = goal.x - actor.x, dz = goal.z - actor.z, length = Math.hypot(dx, dz);
  if (length < .1) return { goal, speed };
  const ux = dx / length, uz = dz / length;
  let blocked = false, pressure = 0;
  for (const { actor: other, distanceSq } of neighbors) {
    const x = other.x - actor.x, z = other.z - actor.z;
    const forward = x * ux + z * uz, lateral = Math.abs(x * uz - z * ux);
    if (forward > -.1 && forward < 1.8 && lateral < .7) blocked = true;
    if (distanceSq < 1.8 ** 2) pressure++;
  }
  if (!blocked) return { goal, speed: Math.min(speed, pressure > 5 ? 1.1 : speed) };
  // Everyone keeps right relative to their own travel direction. Opposing
  // walkers therefore pass on opposite world-space sides, without coin flips.
  const lookAhead = Math.min(1.8, length), side = .75;
  return { goal: { x: actor.x + ux * lookAhead - uz * side, z: actor.z + uz * lookAhead + ux * side },
    speed: Math.min(speed, pressure > 5 ? .65 : 1.05) };
}

/** Resolve pre-existing overlaps with a capped correction, never a teleport.
 * Call world collision afterwards, including for resting civilians. */
export function separateCrowd(actor, neighbors, dt, clearance = .78) {
  let x = 0, z = 0;
  for (const { actor: other } of neighbors) {
    const dx = actor.x - other.x, dz = actor.z - other.z, distance = Math.hypot(dx, dz);
    if (distance >= clearance) continue;
    const push = (clearance - distance) * .5;
    if (distance > .001) { x += dx / distance * push; z += dz / distance * push; }
    else x += (String(actor.id) < String(other.id) ? -1 : 1) * push;
  }
  const length = Math.hypot(x, z), limit = Math.min(.2, Math.max(0, dt) * 1.8);
  if (!(length > 0) || !(limit > 0)) return false;
  const scale = Math.min(1, limit / length);
  actor.x += x * scale; actor.z += z * scale;
  return true;
}

/** Prefer an open connected exit while keeping stable route variety. Counts
 * only the first few metres of an exit, so a distant crowd cannot attract AI. */
export function chooseCrowdExit(actor, exits, people, seed) {
  let best, bestCost = Infinity;
  for (let offset = 0; offset < exits.length; offset++) {
    const exit = exits[(seed + offset) % exits.length];
    const dx = exit.x - actor.x, dz = exit.z - actor.z, length = Math.hypot(dx, dz) || 1;
    const ux = dx / length, uz = dz / length;
    let cost = offset * .025;
    for (const other of people) {
      if (other === actor || !active(other)) continue;
      const x = other.x - actor.x, z = other.z - actor.z, forward = x * ux + z * uz;
      if (forward > .35 && forward < Math.min(length, 9) && Math.abs(x * uz - z * ux) < 1.4)
        cost += 1 - forward / 12;
    }
    if (cost < bestCost) { best = exit; bestCost = cost; }
  }
  return best;
}
