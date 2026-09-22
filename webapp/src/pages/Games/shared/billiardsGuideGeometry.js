/** Clip a ball-centre trajectory at its first obstruction. Coordinates are table X/Y. */
export function clipGuideTravel({
  origin, direction, balls = [], ignoreIds = [], radius, maxDistance,
  halfWidth = Infinity, halfLength = Infinity
}) {
  const length = Math.hypot(direction?.x ?? 0, direction?.y ?? 0);
  if (!(length > 1e-8) || !Number.isFinite(origin?.x) || !Number.isFinite(origin?.y)) return 0;
  const dx = direction.x / length;
  const dy = direction.y / length;
  let travel = Number.isFinite(maxDistance) ? Math.max(0, maxDistance) : Infinity;
  for (const [coordinate, velocity, limit] of [
    [origin.x, dx, halfWidth], [origin.y, dy, halfLength]
  ]) {
    if (Math.abs(velocity) < 1e-8 || !Number.isFinite(limit)) continue;
    const distance = ((velocity > 0 ? limit : -limit) - coordinate) / velocity;
    travel = Math.min(travel, Math.max(0, distance));
  }
  const ignored = new Set(ignoreIds.map(String));
  const diameterSquared = Math.max(0, radius * 2) ** 2;
  for (const ball of balls) {
    if (!ball || ball.active === false || ignored.has(String(ball.id))) continue;
    const position = ball.pos ?? ball.position;
    if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) continue;
    const vx = position.x - origin.x;
    const vy = position.y - origin.y;
    const projection = vx * dx + vy * dy;
    // A touching ball behind the motion cannot obstruct an outgoing trajectory.
    if (projection <= 1e-8) continue;
    const perpendicularSquared = Math.max(0, vx * vx + vy * vy - projection * projection);
    if (perpendicularSquared > diameterSquared) continue;
    const contact = projection - Math.sqrt(diameterSquared - perpendicularSquared);
    travel = Math.min(travel, Math.max(0, contact));
  }
  return Number.isFinite(travel) ? travel : 0;
}
