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
 * @property {{balls:Ball[],pockets:Pocket[],width:number,height:number,ballRadius:number,friction:number,myGroup?:'SOLIDS'|'STRIPES'|'UNASSIGNED',ballOn?:'yellow'|'red'|null,ballInHand?:boolean}} state
 * @property {number} [timeBudgetMs]
 * @property {number} [rngSeed]
 * @property {number} [maxCutAngle] maximum allowed cut angle in radians for a shot candidate
 * @property {number} [minViewScore] minimum required pocket view score for a shot candidate
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
 * @property {{x:number,y:number}} [aimPoint]
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

function pathBlocked (a, b, balls, ignoreIds, radius, margin = 1) {
  return balls.some(
    ball =>
      !ball.pocketed &&
      !ignoreIds.includes(ball.id) &&
      lineIntersectsBall(a, b, ball, radius * margin)
  )
}

function pocketEntry (pocket, radius, width, height) {
  const center = { x: width / 2, y: height / 2 }
  const dir = { x: center.x - pocket.x, y: center.y - pocket.y }
  const len = Math.hypot(dir.x, dir.y) || 1
  const offset = radius * 1.05
  return {
    x: pocket.x + (dir.x / len) * offset,
    y: pocket.y + (dir.y / len) * offset
  }
}

function currentGroup (state) {
  const g = state.myGroup ?? state.ballOn
  if (!g) return undefined
  if (g === 'yellow') return 'SOLIDS'
  if (g === 'red') return 'STRIPES'
  return g
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
    const group = currentGroup(req.state)
    if (group === 'SOLIDS') {
      if (solids.length > 0) return solids
      if (eight) return [eight]
      return []
    }
    if (group === 'STRIPES') {
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
    let group = currentGroup(req.state)
    if (!group || group === 'UNASSIGNED') {
      if (targetId >= 1 && targetId <= 7) group = 'SOLIDS'
      else if (targetId >= 9 && targetId <= 15) group = 'STRIPES'
    }
    if (group === 'SOLIDS') {
      if (solids.length > 0) return solids
      if (eight) return [eight]
      return []
    }
    if (group === 'STRIPES') {
      if (stripes.length > 0) return stripes
      if (eight) return [eight]
      return []
    }
    return cloned.filter(b => b.id !== 8)
  }
  return cloned
}

// Identify target/pocket pairs that satisfy core aiming criteria:
// minimal cut angle and clear pocket entry. Returns sorted candidates,
// preferring smaller cut angles and wider pocket views.
function clearShotCandidates (req) {
  const r = req.state.ballRadius
  const cue = req.state.balls.find(b => b.id === 0)
  const targets = chooseTargets(req)
  const pockets = req.state.pockets
  const maxCut = req.maxCutAngle ?? Math.PI / 4
  const minView = req.minViewScore ?? 0.3
  const candidates = []

  for (const target of targets) {
    for (const pocket of pockets) {
      const entry = pocketEntry(pocket, r, req.state.width, req.state.height)
      const ghost = {
        x: target.x - (entry.x - target.x) * (r * 2 / dist(target, entry)),
        y: target.y - (entry.y - target.y) * (r * 2 / dist(target, entry))
      }

      // ensure ghost is within table bounds
      if (
        ghost.x < r ||
        ghost.x > req.state.width - r ||
        ghost.y < r ||
        ghost.y > req.state.height - r
      ) {
        continue
      }

      // check paths from cue->ghost and target->pocket are unobstructed
      if (
        pathBlocked(cue, ghost, req.state.balls, [0, target.id], r, 1.1) ||
        pathBlocked(target, entry, req.state.balls, [0, target.id], r) ||
        req.state.balls.some(
          b => b.id !== 0 && b.id !== target.id && !b.pocketed && dist(b, entry) < r * 1.1
        )
      ) {
        continue
      }

      const shotVec = { x: target.x - cue.x, y: target.y - cue.y }
      const potVec = { x: entry.x - target.x, y: entry.y - target.y }
      let cut = Math.abs(Math.atan2(potVec.y, potVec.x) - Math.atan2(shotVec.y, shotVec.x))
      if (cut > Math.PI) cut = Math.abs(cut - Math.PI * 2)
      const viewAngle = Math.atan2(r * 2, dist(target, entry))
      const viewScore = Math.min(viewAngle / (Math.PI / 2), 1)

      // require fairly central hit and open pocket view
      if (cut <= maxCut && viewScore >= minView) {
        candidates.push({ target, pocket, cut, view: viewScore })
      }
    }
  }

  candidates.sort((a, b) => a.cut - b.cut || b.view - a.view)
  return candidates
}

export function estimateCueAfterShot (cue, target, pocket, power, spin, table) {
  const toTarget = { x: target.x - cue.x, y: target.y - cue.y }
  const toPocket = { x: pocket.x - target.x, y: pocket.y - target.y }
  const dir = { x: toTarget.x - toPocket.x, y: toTarget.y - toPocket.y }
  const len = Math.hypot(dir.x, dir.y) || 1
  let scale = (power * 120) / len
  // very rough spin model – top/back alter distance, side imparts lateral offset
  scale *= 1 + spin.top - spin.back
  const perp = { x: -dir.y / len, y: dir.x / len }
  const tableScale = Math.max(table.width, table.height) * 0.04
  const sideOffset = spin.side * power * tableScale
  return {
    x: target.x + dir.x * scale + perp.x * sideOffset,
    y: target.y + dir.y * scale + perp.y * sideOffset
  }
}


// Rough Monte Carlo estimate of potting probability by jittering the cue
// aim slightly and checking if paths remain clear. This models human
// imprecision and rewards shorter, straighter shots.
function monteCarloPotChance (req, cue, target, entry, ghost, balls, samples = 20) {
  const r = req.state.ballRadius
  const baseAngle = Math.atan2(ghost.y - cue.y, ghost.x - cue.x)
  const distCG = dist(cue, ghost)
  let success = 0
  for (let i = 0; i < samples; i++) {
    const a = baseAngle + (Math.random() - 0.5) * 0.04 // ±~1°
    const g = { x: cue.x + Math.cos(a) * distCG, y: cue.y + Math.sin(a) * distCG }
    if (
      g.x < r ||
      g.x > req.state.width - r ||
      g.y < r ||
      g.y > req.state.height - r
    ) continue
    if (pathBlocked(cue, g, balls, [0, target.id], r, 1.1)) continue
    if (pathBlocked(target, entry, balls, [0, target.id], r)) continue
    // if jitter deviates too far from ideal contact, treat as miss
    if (dist(g, ghost) > r * 0.5) continue
    success++
  }
  return success / samples
}


function evaluate (req, cue, target, pocket, power, spin, ballsOverride, strict = false) {
  const r = req.state.ballRadius
  const balls = ballsOverride || req.state.balls
  const entry = pocketEntry(pocket, r, req.state.width, req.state.height)
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
    pathBlocked(cue, ghost, balls, [0, target.id], r, 1.1) ||
    pathBlocked(target, entry, balls, [0, target.id], r) ||
    balls.some(b => b.id !== 0 && b.id !== target.id && !b.pocketed && dist(b, entry) < r * 1.1)
  ) {
    return null
  }
  const maxD = Math.hypot(req.state.width, req.state.height)
  const distShot = dist(cue, target) + dist(target, entry)
  const potChance = monteCarloPotChance(req, cue, target, entry, ghost, balls)
  const cueAfter = estimateCueAfterShot(cue, target, entry, power, spin, req.state)
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
  const viewAngle = Math.atan2(r * 2, dist(target, entry))
  const viewScore = Math.min(viewAngle / (Math.PI / 2), 1)
  if (strict && (centerAlign < 0.5 || viewScore < 0.3)) {
    return null
  }
  const quality = Math.max(
    0,
    Math.min(
      1,
      0.35 * potChance + 0.25 * centerAlign + 0.2 * viewScore + 0.1 * nextScore + 0.1 * nearHole - 0.2 * risk
    )
  )
  const angle = Math.atan2(ghost.y - cue.y, ghost.x - cue.x)
  return {
    angleRad: angle,
    power,
    spin,
    targetBallId: target.id,
    targetPocket: entry,
    aimPoint: ghost,
    quality,
    rationale: `target=${target.id} pocket=(${pocket.x.toFixed(0)},${pocket.y.toFixed(0)}) angle=${angle.toFixed(2)} power=${power.toFixed(2)} spin=${spin.top.toFixed(2)},${spin.side.toFixed(2)},${spin.back.toFixed(2)} pc=${potChance.toFixed(2)} ca=${centerAlign.toFixed(2)} nh=${nearHole.toFixed(2)} np=${nextScore.toFixed(2)} r=${risk.toFixed(2)}`
  }
}

function safetyShot (req) {
  const cue = req.state.balls.find(b => b.id === 0)
  const corners = [
    { x: 0, y: 0 },
    { x: req.state.width, y: 0 },
    { x: 0, y: req.state.height },
    { x: req.state.width, y: req.state.height }
  ]
  const target = corners.reduce((best, c) => (dist(cue, c) > dist(cue, best) ? c : best), corners[0])
  const angle = Math.atan2(target.y - cue.y, target.x - cue.x)
  return {
    angleRad: angle,
    power: 0.5,
    spin: { top: 0, side: 0, back: 0 },
    quality: 0,
    rationale: 'safety'
  }
}

/**
 * @param {AimRequest} req
 * @returns {ShotDecision}
 */
export function planShot (req) {
  const r = req.state.ballRadius
  const start = Date.now()
  const deadline = req.timeBudgetMs ? start + req.timeBudgetMs : Infinity
  let best = null

  const powers = [0.5, 0.7, 0.9, 1.0]
  const spins = [
    { top: 0, side: 0, back: 0 },
    { top: 0.3, side: 0, back: -0.3 },
    { top: -0.3, side: 0.3, back: 0 },
    { top: -0.3, side: -0.3, back: 0 },
    { top: 0.5, side: 0, back: -0.5 },
    { top: -0.5, side: 0.5, back: 0 },
    { top: -0.5, side: -0.5, back: 0 },
    { top: 0, side: 0.5, back: 0 }
  ]

  // first, gather candidate target/pocket pairs meeting strict criteria
  let candidatePairs = clearShotCandidates(req)
  if (candidatePairs.length === 0) {
    // fallback: evaluate all target/pocket combinations
    const pockets = req.state.pockets
    const targets = chooseTargets(req)
    candidatePairs = targets.flatMap(t => pockets.map(p => ({ target: t, pocket: p })))
  }

  for (const strict of [true, false]) {
    for (const { target, pocket } of candidatePairs) {
      const entry = pocketEntry(pocket, r, req.state.width, req.state.height)
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
              return best && best.quality >= 0.1 ? best : safetyShot(req)
            }
            const cand = evaluate(req, cuePos, target, pocket, power, spin, balls, strict)
            if (cand && (!best || cand.quality > best.quality)) {
              best = { ...cand, cueBallPosition: req.state.ballInHand ? cuePos : undefined }
            }
          }
        }
      }
    }
    if (best) break
  }

  return best && best.quality >= 0.1 ? best : safetyShot(req)
}

export default planShot
