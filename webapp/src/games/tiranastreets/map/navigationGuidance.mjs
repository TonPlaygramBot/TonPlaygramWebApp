const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function formatRouteDistance(metres) {
  const value = Math.max(0, Number.isFinite(metres) ? metres : 0);
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
}

/** Guidance is derived from the actual routed polyline, never a line through
 * buildings. Map x increases to the right and z increases down the screen. */
export function navigationGuidance(route, player, destination, mode = 'walk') {
  if (!valid(player) || !valid(destination)) return null;
  const driving = mode === 'drive', arrivalRadius = driving ? 10 : 6;
  const directDistance = distance(player, destination);
  if (directDistance <= arrivalRadius) return {
    instruction: 'You have arrived', direction: 'arrive', remaining: directDistance,
    nextDistance: 0, etaSeconds: 0, offRoute: false, arrived: true, accessDistance: 0
  };
  const points = Array.isArray(route) ? route.filter(valid).filter((p, i, all) => !i || distance(p, all[i - 1]) > .01) : [];
  if (!points.length) return {
    instruction: 'Choose a nearby road or path', direction: 'unavailable',
    remaining: directDistance, nextDistance: 0, etaSeconds: null,
    offRoute: false, arrived: false, accessDistance: directDistance
  };
  const tail = new Array(points.length).fill(0);
  for (let i = points.length - 2; i >= 0; i--) tail[i] = tail[i + 1] + distance(points[i], points[i + 1]);
  let nearest = { index: 0, t: 0, distance: distance(player, points[0]), remaining: tail[0] };
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1], dx = b.x - a.x, dz = b.z - a.z;
    const length = Math.hypot(dx, dz), t = clamp(((player.x - a.x) * dx + (player.z - a.z) * dz) / (length * length), 0, 1);
    const gap = Math.hypot(player.x - a.x - dx * t, player.z - a.z - dz * t);
    if (gap < nearest.distance - .001 || i === 0) nearest = { index: i, t, distance: gap, remaining: tail[i + 1] + length * (1 - t) };
  }
  const accessDistance = distance(points.at(-1), destination);
  const remaining = nearest.remaining + accessDistance + nearest.distance;
  const offRoute = nearest.distance > (driving ? 30 : 15);
  const pace = driving ? clamp(Math.abs(Number.isFinite(player.speed) ? player.speed : 8), 5, 15) : 4;
  const result = { instruction: 'Continue ahead', direction: 'straight', remaining,
    nextDistance: nearest.remaining, etaSeconds: Math.ceil(remaining / pace), offRoute,
    arrived: false, accessDistance };
  if (offRoute) return { ...result, instruction: 'Return to the highlighted route', direction: 'rejoin', nextDistance: nearest.distance };
  if (nearest.remaining < (driving ? 14 : 7)) return { ...result,
    instruction: accessDistance > arrivalRadius ? (driving ? 'Park, then walk to the entrance' : 'Continue to the entrance') : 'Destination ahead',
    direction: 'destination', nextDistance: directDistance };
  let travelled = distance(points[nearest.index], points[nearest.index + 1] || points[nearest.index]) * (1 - nearest.t);
  for (let i = nearest.index + 1; i + 1 < points.length; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const ux = b.x - a.x, uz = b.z - a.z, vx = c.x - b.x, vz = c.z - b.z;
    const turn = Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz);
    if (Math.abs(turn) >= Math.PI * .14 && travelled > 1) {
      const direction = Math.abs(turn) > Math.PI * .8 ? 'uturn' : turn > 0 ? 'right' : 'left';
      return { ...result, direction, nextDistance: travelled,
        instruction: direction === 'uturn' ? 'Make a U-turn when clear' : `Turn ${direction}` };
    }
    travelled += distance(b, c);
  }
  return result;
}

/** Sort a copied list, so choosing a nearby service never mutates simulation data. */
export function nearbyServices(places, player, limit = 8) {
  if (!valid(player)) return [];
  return places.filter(p => valid(p) && p.available !== false)
    .map(p => ({ ...p, distance: distance(p, player) }))
    .sort((a, b) => a.distance - b.distance || String(a.id).localeCompare(String(b.id)))
    .slice(0, Math.max(0, limit));
}
