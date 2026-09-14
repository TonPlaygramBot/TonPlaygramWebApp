export const SNOOKER_RESPOT_ORDER = ['BLACK', 'PINK', 'BLUE', 'BROWN', 'GREEN', 'YELLOW'] as const;
type Colour = typeof SNOOKER_RESPOT_ORDER[number];
type Point = { x: number; y: number };
type SpotMap = Partial<Record<Lowercase<Colour>, readonly number[]>>;
type RespotBall = { active: boolean; pos: Point };

/** Find a free colour spot, then the nearest clear point on its longitudinal line. */
export function findSnookerRespotPosition(
  colour: Colour,
  spots: SpotMap,
  balls: readonly RespotBall[],
  options: {
    radius: number;
    limitX: number;
    limitY: number;
    reserved?: readonly Point[];
    fits?: (point: Point) => boolean;
  }
): Point | null {
  const own = spots[colour.toLowerCase() as Lowercase<Colour>];
  if (!own || own.length < 2 || !(options.radius > 0)) return null;
  const clearance = options.radius * 2.02;
  const occupied = [
    ...balls.filter(ball => ball.active).map(ball => ball.pos),
    ...(options.reserved ?? [])
  ];
  const clear = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y) &&
    Math.abs(point.x) <= options.limitX && Math.abs(point.y) <= options.limitY &&
    (!options.fits || options.fits(point)) && occupied.every(other =>
      Math.hypot(other.x - point.x, other.y - point.y) >= clearance);
  const base = { x: own[0], y: own[1] };
  for (const name of [colour, ...SNOOKER_RESPOT_ORDER.filter(entry => entry !== colour)]) {
    const spot = spots[name.toLowerCase() as Lowercase<Colour>];
    if (!spot) continue;
    const candidate = { x: spot[0], y: spot[1] };
    if (clear(candidate)) return candidate;
  }

  // Along the ball's own line, each blocking ball excludes one interval.
  // Searching interval boundaries avoids skipping the nearest available point.
  const epsilon = options.radius * 0.0001;
  const blackEnd = Math.sign((spots.black?.[1] ?? options.limitY) -
    (spots.brown?.[1] ?? -options.limitY)) || 1;
  for (const direction of [blackEnd, -blackEnd]) {
    const candidates = occupied.flatMap(other => {
      const dx = other.x - base.x;
      if (Math.abs(dx) >= clearance) return [];
      const dy = Math.sqrt(clearance * clearance - dx * dx);
      return [other.y + direction * (dy + epsilon)];
    }).filter(y => (y - base.y) * direction >= 0)
      .sort((a, b) => (a - b) * direction);
    for (const y of candidates) {
      const candidate = { x: base.x, y };
      if (clear(candidate)) return candidate;
    }
  }
  // Never revive a ball on an occupied or out-of-bounds fallback spot.
  return null;
}
