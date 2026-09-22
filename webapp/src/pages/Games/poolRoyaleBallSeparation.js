const DEFAULT_ITERATIONS = 256
const MAX_ITERATIONS = 512

const finitePosition = (ball) => Number.isFinite(ball?.pos?.x) && Number.isFinite(ball?.pos?.y)
const ballRadius = (ball, fallback) => Number.isFinite(ball?.radius) && ball.radius > 0 ? ball.radius : fallback
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value))

function stablePairAngle (a, b) {
  const key = `${a.id}:${b.id}`
  let hash = 2166136261
  for (let i = 0; i < key.length; i += 1) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619)
  return ((hash >>> 0) / 4294967296) * Math.PI * 2
}

/**
 * Position-only non-penetration solve; never changes velocity, spin, contact
 * records or sounds. The old numeric third argument remains supported.
 *
 * `projectBall(ball, radius)` may move ball.pos out of cushion/jaw solids after
 * each pass. It must only project positions: calling the live rail impulse
 * function here would add energy and manufacture rail-contact rule events.
 * `bounds`, when provided, contains permitted centre coordinates, not rail edges.
 * Pocketed/invalid balls are ignored. Equal-radius balls use minimumDistance / 2;
 * an explicit ball.radius is honoured when a layout contains different radii.
 */
export function separatePoolBalls (balls, minimumDistance, iterationsOrOptions = DEFAULT_ITERATIONS) {
  if (!Array.isArray(balls) || !Number.isFinite(minimumDistance) || minimumDistance <= 0) return false
  const options = typeof iterationsOrOptions === 'object' && iterationsOrOptions !== null
    ? iterationsOrOptions : { iterations: iterationsOrOptions }
  const requestedIterations = options.iterations ?? DEFAULT_ITERATIONS
  const passCount = Number.isFinite(requestedIterations)
    ? clamp(Math.floor(requestedIterations), 1, MAX_ITERATIONS) : DEFAULT_ITERATIONS
  const tolerance = Number.isFinite(options.tolerance) && options.tolerance >= 0
    ? options.tolerance : minimumDistance * 1e-7
  const fallbackRadius = minimumDistance / 2
  const activeBalls = balls.filter(ball => ball?.active && finitePosition(ball))
  // Sorting the tiny (at most 16 ball) list makes identical snapshots settle the
  // same way even if multiplayer serialization changes array order.
  activeBalls.sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0)
  const radii = activeBalls.map(ball => ballRadius(ball, fallbackRadius))
  const bounds = options.bounds
  const hasBounds = bounds && ['minX', 'maxX', 'minY', 'maxY'].every(key => Number.isFinite(bounds[key])) &&
    bounds.minX <= bounds.maxX && bounds.minY <= bounds.maxY
  const projectBall = typeof options.projectBall === 'function' ? options.projectBall : null
  let changed = false

  for (let pass = 0; pass < passCount; pass += 1) {
    let correctedThisPass = false
    for (let i = 0; i < activeBalls.length; i += 1) {
      for (let j = i + 1; j < activeBalls.length; j += 1) {
        const a = activeBalls[i]
        const b = activeBalls[j]
        const dx = b.pos.x - a.pos.x
        const dy = b.pos.y - a.pos.y
        const requiredDistance = radii[i] + radii[j]
        const distanceSquared = dx * dx + dy * dy
        // Most frames have no overlaps; avoid sqrt in their 120-pair scan.
        if (distanceSquared >= Math.max(0, requiredDistance - tolerance) ** 2) continue
        const distance = Math.sqrt(distanceSquared)
        let nx
        let ny
        if (distance > requiredDistance * 1e-10) {
          nx = dx / distance
          ny = dy / distance
        } else {
          // Diverse deterministic normals let fully coincident clusters spread
          // in two dimensions instead of collapsing into a single diagonal.
          const angle = stablePairAngle(a, b)
          nx = Math.cos(angle)
          ny = Math.sin(angle)
        }
        // Ordinary contacts settle in the first few passes. Over-relax only
        // stubborn clusters so a long chain against a cushion converges without
        // thousands of passes; this still changes positions, never velocities.
        const relaxation = pass < 4 ? 1 : 1.75
        const correction = (requiredDistance - distance + tolerance * 0.25) * 0.5 * relaxation
        a.pos.x -= nx * correction
        a.pos.y -= ny * correction
        b.pos.x += nx * correction
        b.pos.y += ny * correction
        correctedThisPass = true
        changed = true
      }
    }
    if (hasBounds || projectBall) {
      for (let i = 0; i < activeBalls.length; i += 1) {
        const ball = activeBalls[i]
        const beforeX = ball.pos.x
        const beforeY = ball.pos.y
        if (hasBounds) {
          ball.pos.x = clamp(ball.pos.x, bounds.minX, bounds.maxX)
          ball.pos.y = clamp(ball.pos.y, bounds.minY, bounds.maxY)
        }
        if (projectBall) projectBall(ball, radii[i])
        if (Math.abs(ball.pos.x - beforeX) > tolerance || Math.abs(ball.pos.y - beforeY) > tolerance) {
          correctedThisPass = true
          changed = true
        }
      }
    }
    if (!correctedThisPass) break
  }
  return changed
}

/**
 * Find a legal centre inside a ball-in-hand rectangle without moving any object
 * ball. `bounds` are centre limits (already inset by the cue-ball radius).
 * `clearanceMultiplier` uses the existing PoolRoyal BALL_R multiplier convention,
 * but can never request less than the physical diameters. `acceptPosition` can
 * additionally reject pocket/cushion geometry. Returns a plain {x, y} or null.
 */
export function findClearPoolBallPosition (balls, preferred, {
  radius,
  bounds,
  excludeId = 'cue',
  clearanceMultiplier = 2.05,
  maxRadius = radius * 3.2,
  acceptPosition
} = {}) {
  if (!Number.isFinite(radius) || radius <= 0 || !preferred ||
      !Number.isFinite(preferred.x) || !Number.isFinite(preferred.y) || !bounds ||
      !['minX', 'maxX', 'minY', 'maxY'].every(key => Number.isFinite(bounds[key])) ||
      bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) return null
  const extraClearance = Math.max(0, (Number.isFinite(clearanceMultiplier) ? clearanceMultiplier : 2.05) - 2) * radius
  const epsilon = radius * 1e-7
  const obstacles = (Array.isArray(balls) ? balls : []).filter(ball =>
    ball?.active && ball.id !== excludeId && finitePosition(ball)).map(ball => ({
    x: ball.pos.x, y: ball.pos.y, clearance: radius + ballRadius(ball, radius) + extraClearance
  }))
  const start = {
    x: clamp(preferred.x, bounds.minX, bounds.maxX),
    y: clamp(preferred.y, bounds.minY, bounds.maxY)
  }
  const valid = (position) => (!acceptPosition || acceptPosition(position)) && obstacles.every(ball => {
    const dx = position.x - ball.x
    const dy = position.y - ball.y
    return dx * dx + dy * dy >= ball.clearance * ball.clearance
  })
  if (valid(start)) return start

  // Preserve drag locality first; every candidate is checked after clamping.
  const ringStep = radius * 0.35
  const localRadius = Number.isFinite(maxRadius) ? Math.max(0, maxRadius) : radius * 3.2
  const rings = Math.min(64, Math.ceil(localRadius / ringStep))
  for (let ring = 1; ring <= rings; ring += 1) {
    for (let angleIndex = 0; angleIndex < 24; angleIndex += 1) {
      const angle = angleIndex * Math.PI / 12
      const candidate = {
        x: clamp(start.x + Math.cos(angle) * ring * ringStep, bounds.minX, bounds.maxX),
        y: clamp(start.y + Math.sin(angle) * ring * ringStep, bounds.minY, bounds.maxY)
      }
      if (valid(candidate)) return candidate
    }
  }

  // Sweep useful rows and project the preferred x out of the exact circle
  // intervals. Unlike returning the "least overlapped" candidate, this fallback
  // only returns positions whose distance from every ball has been verified.
  const rows = [start.y, bounds.minY, bounds.maxY, (bounds.minY + bounds.maxY) / 2]
  for (const obstacle of obstacles) {
    rows.push(obstacle.y, obstacle.y - obstacle.clearance - epsilon, obstacle.y + obstacle.clearance + epsilon)
  }
  const rowCount = Math.min(128, Math.max(1, Math.ceil((bounds.maxY - bounds.minY) / radius)))
  for (let row = 1; row < rowCount; row += 1) rows.push(bounds.minY + (bounds.maxY - bounds.minY) * row / rowCount)
  rows.sort((a, b) => Math.abs(a - start.y) - Math.abs(b - start.y) || a - b)
  for (const y of rows) {
    if (y < bounds.minY || y > bounds.maxY) continue
    const xs = [start.x, bounds.minX, bounds.maxX]
    for (const obstacle of obstacles) {
      const dy = y - obstacle.y
      if (Math.abs(dy) >= obstacle.clearance) continue
      const width = Math.sqrt(Math.max(0, obstacle.clearance ** 2 - dy * dy)) + epsilon
      xs.push(obstacle.x - width, obstacle.x + width)
    }
    xs.sort((a, b) => Math.abs(a - start.x) - Math.abs(b - start.x) || a - b)
    for (const x of xs) {
      if (x < bounds.minX || x > bounds.maxX) continue
      const candidate = { x, y }
      if (valid(candidate)) return candidate
    }
  }
  return null
}
