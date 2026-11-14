// WPBSA section 2.17: both extreme edges of at least one ball on must
// be available. Another ball on (e.g. another red) cannot create a snooker.
function colourOf(ball) {
  // Render objects also carry numeric material colors; the physical ID is
  // authoritative when that color is not a snooker colour name.
  for (const value of [ball?.id, ball?.color, ball?.colour]) {
    const text = String(value ?? '').toUpperCase();
    if (text.startsWith('RED')) return 'RED';
    if (text === 'WHITE' || text === 'CUE_BALL' || text === 'CUE') return 'CUE';
    for (const color of ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK']) {
      if (text === color || text.startsWith(`${color}_`)) return color;
    }
  }
  return '';
}

function positionOf(ball) {
  const position = ball?.pos ?? ball?.position ?? ball;
  return Number.isFinite(position?.x) && Number.isFinite(position?.y) ? position : null;
}

function live(ball) {
  return ball?.active !== false && ball?.onTable !== false && !ball?.potted;
}

function intersectsBefore(origin, direction, distance, ball, radius, epsilon) {
  const point = positionOf(ball);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const along = dx * direction.x + dy * direction.y;
  const perpendicularSquared = Math.max(0, dx * dx + dy * dy - along * along);
  const expandedRadius = radius + (Number.isFinite(ball.radius) ? ball.radius : radius);
  if (perpendicularSquared >= (expandedRadius - epsilon) ** 2) return false;
  const halfChord = Math.sqrt(Math.max(0, expandedRadius ** 2 - perpendicularSquared));
  return along + halfChord > epsilon && along - halfChord < distance - epsilon;
}

// Positive evidence for an automatic miss call. Centre and interior edge rays
// prove a direct hit exists; an untested narrow gap never produces a penalty.
export function inspectSnookerDirectContact({ cue, balls, ballOn, ballRadius, direction }) {
  const result = { clearPathToBallOn: false, fullBallContactAvailable: false,
    touchingBallIds: [], touchingBallPlayedAway: undefined, pushedTouchingBallIds: [] };
  const origin = positionOf(cue);
  if (!origin || !live(cue) || !(ballRadius > 0)) return result;
  const on = new Set((ballOn ?? []).map(value => String(value).toUpperCase()));
  const objects = (balls ?? []).filter(ball => ball !== cue && live(ball) &&
    colourOf(ball) !== 'CUE' && positionOf(ball));
  const epsilon = ballRadius * 1e-6;
  const touching = objects.filter(ball => {
    const point = positionOf(ball);
    const radius = ballRadius + (Number.isFinite(ball.radius) ? ball.radius : ballRadius);
    return Math.hypot(point.x - origin.x, point.y - origin.y) <= radius + epsilon;
  });
  result.touchingBallIds = touching.map(ball => String(ball.id));
  if (touching.length && Number.isFinite(direction?.x) && Number.isFinite(direction?.y)) {
    result.pushedTouchingBallIds = touching.filter(ball => {
      const point = positionOf(ball);
      return (point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y > epsilon;
    }).map(ball => String(ball.id));
    result.touchingBallPlayedAway = result.pushedTouchingBallIds.length === 0;
  }
  for (const target of objects.filter(ball => on.has(colourOf(ball)))) {
    const point = positionOf(target);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const distance = Math.hypot(dx, dy);
    const radius = ballRadius + (Number.isFinite(target.radius) ? target.radius : ballRadius);
    if (distance <= radius + epsilon) {
      result.clearPathToBallOn = true;
      result.fullBallContactAvailable = true;
      continue;
    }
    const centreAngle = Math.atan2(dy, dx);
    const tangentAngle = Math.asin(radius / distance);
    const blockers = objects.filter(ball => ball !== target);
    for (const fraction of [0, -0.99, -0.75, -0.5, 0.5, 0.75, 0.99]) {
      const angle = centreAngle + tangentAngle * fraction;
      const ray = { x: Math.cos(angle), y: Math.sin(angle) };
      const along = dx * ray.x + dy * ray.y;
      const acrossSquared = Math.max(0, distance * distance - along * along);
      const firstImpact = along - Math.sqrt(Math.max(0, radius * radius - acrossSquared));
      if (blockers.some(ball => intersectsBefore(origin, ray, firstImpact, ball, ballRadius, epsilon))) continue;
      result.clearPathToBallOn = true;
      if (fraction === 0) result.fullBallContactAvailable = true;
    }
  }
  return result;
}

export function isSnookerObstructed({ cue, balls, ballOn, ballRadius, ballInHand = false }) {
  // A sampled set of D positions cannot prove obstruction at every possible
  // placement. Do not award a free ball using a pocketed cue's old position.
  if (ballInHand || !live(cue) || !(ballRadius > 0)) return false;
  const origin = positionOf(cue);
  if (!origin) return false;
  const on = new Set((ballOn ?? []).map(value => String(value).toUpperCase()));
  const objects = (balls ?? []).filter(ball => ball !== cue && live(ball) &&
    colourOf(ball) !== 'CUE' && positionOf(ball));
  const targets = objects.filter(ball => on.has(colourOf(ball)));
  if (!targets.length) return false;
  const blockers = objects.filter(ball => !on.has(colourOf(ball)));
  if (!blockers.length) return false;
  const epsilon = ballRadius * 1e-6;

  return targets.every(target => {
    const point = positionOf(target);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const distance = Math.hypot(dx, dy);
    const expandedRadius = ballRadius + (Number.isFinite(target.radius) ? target.radius : ballRadius);
    // A touching ball on can be played away from without contacting another.
    if (distance <= expandedRadius + epsilon) return false;
    const centreAngle = Math.atan2(dy, dx);
    const tangentAngle = Math.asin(expandedRadius / distance);
    const tangentDistance = Math.sqrt(distance * distance - expandedRadius * expandedRadius);
    return [-1, 1].some(side => {
      const angle = centreAngle + side * tangentAngle;
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      return blockers.some(ball => intersectsBefore(origin, direction, tangentDistance, ball, ballRadius, epsilon));
    });
  });
}
