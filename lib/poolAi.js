// Minimal billiards AI planner

/** @typedef {'AMERICAN_BILLIARDS'|'NINE_BALL'|'EIGHT_POOL_UK'} GameType */

/**
 * @typedef {Object} Ball
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {boolean} pocketed
 */

/** @typedef {{x:number,y:number}} Pocket */

/**
 * @typedef {Object} AimRequest
 * @property {GameType} game
 * @property {{balls:Ball[],pockets:Pocket[],width:number,height:number,ballRadius:number,friction:number,myGroup?:'SOLIDS'|'STRIPES'|'UNASSIGNED',ballInHand?:boolean}} state
 * @property {number} [timeBudgetMs]
 * @property {number} [rngSeed]
 */

/**
 * @typedef {Object} ShotDecision
 * @property {number} angleRad
 * @property {number} power
 * @property {{top:number,side:number,back:number}} spin
 * @property {number} [targetBallId]
 * @property {{x:number,y:number}} [targetPocket]
 * @property {number} quality
 * @property {string} rationale
 * @property {{x:number,y:number}} [cueBallPosition]
 */

function dist (a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

function lineIntersectsBall (a, b, ball, radius) {
  const apx = ball.x - a.x
  const apy = ball.y - a.y
  const abx = b.x - a.x
  const aby = b.y - a.y
  const t = (apx * abx + apy * aby) / (abx * abx + aby * aby)
  if (t <= 0 || t >= 1) return false
  const closest = { x: a.x + abx * t, y: a.y + aby * t }
  return dist(closest, ball) < radius * 2
}

function pathBlocked (a, b, balls, ignoreIds, radius) {
  return balls.some(
    ball =>
      !ball.pocketed &&
      !ignoreIds.includes(ball.id) &&
      lineIntersectsBall(a, b, ball, radius)
  )
}

function pocketEntry (ball, pocket, radius) {
  const dir = { x: ball.x - pocket.x, y: ball.y - pocket.y }
  const len = Math.hypot(dir.x, dir.y) || 1
  const offset = radius * 1.05
  return {
    x: pocket.x + (dir.x / len) * offset,
    y: pocket.y + (dir.y / len) * offset
  }
}

function chooseTargets (req) {
  const balls = req.state.balls.filter(b => !b.pocketed && b.id !== 0)
  if (req.game === 'NINE_BALL' || req.game === 'AMERICAN_BILLIARDS') {
    const lowest = balls.reduce((m, b) => (b.id < m.id ? b : m), balls[0])
    return lowest ? [lowest] : []
  }
  if (req.game === 'EIGHT_POOL_UK') {
    const solids = balls.filter(b => b.id >= 1 && b.id <= 7)
    const stripes = balls.filter(b => b.id >= 9 && b.id <= 15)
    const eight = balls.find(b => b.id === 8)
    if (req.state.myGroup === 'SOLIDS') {
      if (solids.length > 0) return solids
      if (eight) return [eight]
      return []
    }
    if (req.state.myGroup === 'STRIPES') {
      if (stripes.length > 0) return stripes
      if (eight) return [eight]
      return []
    }
    return balls.filter(b => b.id !== 8)
  }
  return balls
}

function nextTargetsAfter (targetId, req) {
  const cloned = req.state.balls.filter(b => !b.pocketed && b.id !== targetId && b.id !== 0)
  if (req.game === 'NINE_BALL' || req.game === 'AMERICAN_BILLIARDS') {
    if (cloned.length === 0) return []
    const lowest = cloned.reduce((m, b) => (b.id < m.id ? b : m), cloned[0])
    return lowest ? [lowest] : []
  }
  if (req.game === 'EIGHT_POOL_UK') {
    const solids = cloned.filter(b => b.id >= 1 && b.id <= 7)
    const stripes = cloned.filter(b => b.id >= 9 && b.id <= 15)
    const eight = cloned.find(b => b.id === 8)
    if (req.state.myGroup === 'SOLIDS') {
      if (solids.length > 0) return solids
      if (eight) return [eight]
      return []
    }
    if (req.state.myGroup === 'STRIPES') {
      if (stripes.length > 0) return stripes
      if (eight) return [eight]
      return []
    }
    return cloned.filter(b => b.id !== 8)
  }
  return cloned
}

function estimateCueAfterShot (cue, target, pocket, power, spin) {
  const toTarget = { x: target.x - cue.x, y: target.y - cue.y }
  const toPocket = { x: pocket.x - target.x, y: pocket.y - target.y }
  const dir = { x: toTarget.x - toPocket.x, y: toTarget.y - toPocket.y }
  const len = Math.hypot(dir.x, dir.y) || 1
  let scale = (power * 120) / len
  // very rough spin model – top/back alter distance, side imparts lateral offset
  scale *= 1 + spin.top - spin.back
  const perp = { x: -dir.y / len, y: dir.x / len }
  const sideOffset = spin.side * 40 // arbitrary side spin strength
  return {
    x: target.x + dir.x * scale + perp.x * sideOffset,
    y: target.y + dir.y * scale + perp.y * sideOffset
  }
}

function blocked (cue, ghost, balls, ignoreId, radius) {
  return balls.some(b => b.id !== 0 && b.id !== ignoreId && !b.pocketed && lineIntersectsBall(cue, ghost, b, radius))
}

function evaluate (req, cue, target, pocket, power, spin, ballsOverride) {
  const r = req.state.ballRadius
  const balls = ballsOverride || req.state.balls
  const entry = pocketEntry(target, pocket, r)
  const ghost = {
    x: target.x - (entry.x - target.x) * (r * 2 / dist(target, entry)),
    y: target.y - (entry.y - target.y) * (r * 2 / dist(target, entry))
  }
  // if ghost lies outside playable area, shot is impossible
  if (
    ghost.x < r ||
    ghost.x > req.state.width - r ||
    ghost.y < r ||
    ghost.y > req.state.height - r
  ) {
    return null
  }
  if (
    blocked(cue, ghost, balls, target.id, r) ||
    pathBlocked(target, entry, balls, [0, target.id], r) ||
    balls.some(b => b.id !== 0 && b.id !== target.id && !b.pocketed && dist(b, entry) < r * 1.1)
  ) {
    return null
  }
  const maxD = Math.hypot(req.state.width, req.state.height)
  const distShot = dist(cue, target) + dist(target, entry)
  const potChance = 1 - Math.min(distShot / maxD, 1)
  const cueAfter = estimateCueAfterShot(cue, target, entry, power, spin)
  const nextTargets = nextTargetsAfter(target.id, { ...req, state: { ...req.state, balls } })
  let nextScore = 0
  if (nextTargets.length > 0) {
    const next = nextTargets[0]
    nextScore = 1 - Math.min(dist(cueAfter, next) / maxD, 1)
  }
  const risk = req.state.pockets.some(p => dist(cueAfter, p) < r * 1.2) ? 1 : 0
  const shotVec = { x: target.x - cue.x, y: target.y - cue.y }
  const potVec = { x: entry.x - target.x, y: entry.y - target.y }
  const cutAngle = Math.abs(Math.atan2(potVec.y, potVec.x) - Math.atan2(shotVec.y, shotVec.x))
  const centerAlign = 1 - Math.min(cutAngle / (Math.PI / 2), 1)
  const nearHole = 1 - Math.min(dist(target, entry) / (r * 20), 1)
  const quality = Math.max(
    0,
    Math.min(
      1,
      0.4 * potChance + 0.3 * centerAlign + 0.2 * nextScore + 0.1 * nearHole - 0.2 * risk
    )
  )
  const angle = Math.atan2(ghost.y - cue.y, ghost.x - cue.x)
  return {
    angleRad: angle,
    power,
    spin,
    targetBallId: target.id,
    targetPocket: pocket,
    quality,
    rationale: `target=${target.id} pocket=(${pocket.x.toFixed(0)},${pocket.y.toFixed(0)}) angle=${angle.toFixed(2)} power=${power.toFixed(2)} spin=${spin.top.toFixed(2)},${spin.side.toFixed(2)},${spin.back.toFixed(2)} pc=${potChance.toFixed(2)} ca=${centerAlign.toFixed(2)} nh=${nearHole.toFixed(2)} np=${nextScore.toFixed(2)} r=${risk.toFixed(2)}`
  }
}

/**
 * @param {AimRequest} req
 * @returns {ShotDecision}
 */
export function planShot (req) {
  const pockets = req.state.pockets
  const targets = chooseTargets(req)
  const start = Date.now()
  const deadline = req.timeBudgetMs ? start + req.timeBudgetMs : Infinity
  const r = req.state.ballRadius
  let best = null

  const powers = [0.6, 0.8, 1.0]
  const spins = [
    { top: 0, side: 0, back: 0 },
    { top: 0.3, side: 0, back: -0.3 },
    { top: -0.3, side: 0.3, back: 0 },
    { top: -0.3, side: -0.3, back: 0 }
  ]

  for (const target of targets) {
    for (const pocket of pockets) {
      const entry = pocketEntry(target, pocket, r)
      // ball in hand: sample cue placements along pocket-target line
      const placements = []
      if (req.state.ballInHand) {
        const toPocket = { x: entry.x - target.x, y: entry.y - target.y }
        const distTP = Math.hypot(toPocket.x, toPocket.y) || 1
        const dir = { x: target.x - entry.x, y: target.y - entry.y }
        const ghost = {
          x: target.x - (entry.x - target.x) * (r * 2 / dist(target, entry)),
          y: target.y - (entry.y - target.y) * (r * 2 / dist(target, entry))
        }
        const dists = [4, 6, 8, 10, 12].map(m => m * r)
        for (const d of dists) {
          const cand = { x: ghost.x + (dir.x / distTP) * d, y: ghost.y + (dir.y / distTP) * d }
          if (
            cand.x < r ||
            cand.x > req.state.width - r ||
            cand.y < r ||
            cand.y > req.state.height - r
          ) {
            continue
          }
          const overlap = req.state.balls.some(
            b => b.id !== 0 && !b.pocketed && dist(cand, b) < r * 2
          )
          if (overlap) continue
          placements.push(cand)
        }
      } else {
        const cue = req.state.balls.find(b => b.id === 0)
        placements.push({ x: cue.x, y: cue.y })
      }

      for (const cuePos of placements) {
        const balls = req.state.balls.map(b =>
          b.id === 0 ? { ...b, x: cuePos.x, y: cuePos.y } : b
        )
        for (const power of powers) {
          for (const spin of spins) {
            if (Date.now() > deadline) {
              return best || {
                angleRad: 0,
                power: 0,
                spin: { top: 0, side: 0, back: 0 },
                quality: 0,
                rationale: 'no shot'
              }
            }
            const cand = evaluate(req, cuePos, target, pocket, power, spin, balls)
            if (cand && (!best || cand.quality > best.quality)) {
              best = { ...cand, cueBallPosition: req.state.ballInHand ? cuePos : undefined }
            }
          }
        }
      }
    }
  }

  return best || {
    angleRad: 0,
    power: 0,
    spin: { top: 0, side: 0, back: 0 },
    quality: 0,
    rationale: 'no shot'
  }
}

export default planShot
