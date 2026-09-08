type Position = { x: number; z: number };
type TableBall = { active: boolean; pos: { x: number; y: number } };
type Spots = Record<string, readonly number[]>;

export const SNOOKER_RESPOT_PRIORITY = ['BLACK', 'PINK', 'BLUE', 'BROWN', 'GREEN', 'YELLOW'];

/** Choose a vacant spot without moving any ball already on the table. */
export function findSnookerRespot(
  color: string,
  spots: Spots,
  balls: readonly TableBall[],
  reserved: readonly Position[],
  radius: number,
  railLimit: number
): Position | null {
  const own = spots[color.toLowerCase()];
  if (!own) return null;
  const gap = radius * 2.02;
  const clear = (p: Position) =>
    Math.abs(p.z) <= railLimit &&
    balls.every(b => !b.active || Math.hypot(b.pos.x - p.x, b.pos.y - p.z) >= gap) &&
    reserved.every(b => Math.hypot(b.x - p.x, b.z - p.z) >= gap);
  for (const name of [color, ...SNOOKER_RESPOT_PRIORITY.filter(c => c !== color)]) {
    const spot = spots[name.toLowerCase()];
    if (!spot) continue;
    const candidate = { x: spot[0], z: spot[1] };
    if (clear(candidate)) return candidate;
  }

  // When every spot is occupied, find the closest clear point along the
  // longitudinal line towards the black cushion. Pink/black may go the other
  // way if there is no room. The model's black spot determines that direction.
  const direction = (spots.black?.[1] ?? 1) >= (spots.brown?.[1] ?? -1) ? 1 : -1;
  const directions = color === 'BLACK' || color === 'PINK' ? [direction, -direction] : [direction];
  for (const sign of directions) {
    let z = own[1];
    const obstacles = [
      ...balls.filter(b => b.active).map(b => ({ x: b.pos.x, z: b.pos.y })),
      ...reserved
    ];
    // Jump past each overlapping ball's exclusion interval, preserving x.
    for (let i = 0; i <= obstacles.length; i++) {
      const candidate = { x: own[0], z };
      if (clear(candidate)) return candidate;
      const overlapping = obstacles.filter(b => Math.hypot(b.x - own[0], b.z - z) < gap);
      if (!overlapping.length) break;
      const edges = overlapping.map(b => b.z + sign * (Math.sqrt(gap * gap - (b.x - own[0]) ** 2) + radius * 0.001));
      z = sign > 0 ? Math.max(...edges) : Math.min(...edges);
      if (Math.abs(z) > railLimit) break;
    }
  }
  return null;
}
