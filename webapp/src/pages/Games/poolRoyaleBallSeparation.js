const FALLBACK_NORMAL_X = Math.SQRT1_2

/**
 * Resolve positional penetration after the velocity collision pass.
 *
 * A single pair pass is not enough for a rack or a three-ball chain: moving the
 * middle ball away from one neighbour can push it into the other. Repeating the
 * constraint pass produces physically valid centre spacing without applying a
 * second collision impulse.
 */
export function separatePoolBalls (balls, minimumDistance, iterations = 4) {
  if (!Array.isArray(balls) || !(minimumDistance > 0)) return false

  const activeBalls = balls.filter((ball) => ball?.active && ball?.pos)
  const passCount = Math.max(1, Math.floor(iterations))
  let changed = false

  for (let pass = 0; pass < passCount; pass += 1) {
    let correctedThisPass = false
    for (let i = 0; i < activeBalls.length; i += 1) {
      for (let j = i + 1; j < activeBalls.length; j += 1) {
        const a = activeBalls[i]
        const b = activeBalls[j]
        const dx = b.pos.x - a.pos.x
        const dy = b.pos.y - a.pos.y
        const distance = Math.hypot(dx, dy)
        const penetration = minimumDistance - distance
        if (penetration <= 1e-9) continue

        // Stable fallback for exactly coincident balls; the id-derived sign
        // prevents every degenerate pair from being pushed in one direction.
        const fallbackSign = String(a.id ?? i) < String(b.id ?? j) ? 1 : -1
        const nx = distance > 1e-9 ? dx / distance : FALLBACK_NORMAL_X * fallbackSign
        const ny = distance > 1e-9 ? dy / distance : FALLBACK_NORMAL_X
        const correction = penetration * 0.5
        a.pos.x -= nx * correction
        a.pos.y -= ny * correction
        b.pos.x += nx * correction
        b.pos.y += ny * correction
        correctedThisPass = true
        changed = true
      }
    }
    if (!correctedThisPass) break
  }

  return changed
}
