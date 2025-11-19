// Advanced UK 8-Ball Pool AI planner
// Generates candidate shots, evaluates probabilities and positional play,
// and returns the best plan according to expected value heuristics.

/**
 * @typedef {'blue'|'red'|'black'|'cue'} BallColour
 *
 * @typedef {Object} Ball
 * @property {number} id
 * @property {BallColour} colour
 * @property {number} x
 * @property {number} y
 * @property {boolean} [pocketed]
 *
 * @typedef {Object} Pocket
 * @property {number} x
 * @property {number} y
 * @property {'TL'|'TR'|'ML'|'MR'|'BL'|'BR'} name
 *
 * @typedef {Object} TableState
 * @property {Ball[]} balls
 * @property {Pocket[]} pockets
 * @property {number} width
 * @property {number} height
 * @property {number} ballRadius
 * @property {'blue'|'red'|null} [ballOn]   // group of current player; null on open table
 * @property {boolean} [isOpenTable]
 * @property {number} [shotsRemaining]
 * @property {boolean} [mustPlayFromBaulk]    // cue ball must be placed behind baulk line
 * @property {number} [baulkLineX]            // x coordinate of baulk line for ball in hand
 *
 * @typedef {Object} CandidateShot
 * @property {'pot'|'safety'} actionType
 * @property {Ball|null} targetBall
 * @property {Pocket|null} pocket
 * @property {{speed:'soft'|'med'|'firm',spin:'stun'|'followS'|'followL'|'drawS'|'drawL'|'sideL'|'sideR'}} cueParams
 * @property {boolean} [isSafety]
 *
 * @typedef {Object} Plan
 * @property {'pot'|'safety'} actionType
 * @property {'blue'|'red'|'black'|null} targetBall
 * @property {number|string|null} [targetId]
 * @property {'TL'|'TR'|'ML'|'MR'|'BL'|'BR'|null} pocket
 * @property {{x:number,y:number}} aimPoint
 * @property {{speed:'soft'|'med'|'firm',spin:'stun'|'followS'|'followL'|'drawS'|'drawL'|'sideL'|'sideR'}} cueParams
 * @property {{x:number,y:number,radius:number}} positionTarget
 * @property {number} EV
 * @property {string} notes
 * @property {number} [angle]        // angle cue->ball->pocket in radians
 * @property {number} [distToPocket]  // distance from object ball to pocket
 */

// ----------------- learning memory -----------------
/**
 * Map keyed by discretised angle and distance storing shot outcomes.
 * Each entry: { success:number, attempts:number }
 */
const shotMemory = new Map()

export function recordShotOutcome (plan, success) {
  if (!plan || typeof plan.angle !== 'number' || typeof plan.distToPocket !== 'number') return
  const angleBucket = Math.round((plan.angle * 180 / Math.PI) / 10) // 10° buckets
  const distBucket = Math.round(plan.distToPocket / 50) // 50px buckets
  const key = `${angleBucket}:${distBucket}`
  const stats = shotMemory.get(key) || { success: 0, attempts: 0 }
  stats.attempts += 1
  if (success) stats.success += 1
  shotMemory.set(key, stats)
}

export function __resetShotMemory () {
  shotMemory.clear()
}

// Common cue parameter variations used by the planner.  By exploring
// different spin and speed combinations for each candidate pot the AI can
// better control cue ball positioning, enabling more competitive and
// precision play similar to expert level snooker players.
const CUE_VARIATIONS = [
  { speed: 'soft', spin: 'stun' },
  { speed: 'med', spin: 'stun' },
  { speed: 'firm', spin: 'stun' },
  { speed: 'med', spin: 'followS' },
  { speed: 'firm', spin: 'followL' },
  { speed: 'med', spin: 'drawS' },
  { speed: 'firm', spin: 'drawL' },
  { speed: 'med', spin: 'sideL' },
  { speed: 'med', spin: 'sideR' }
]

// ----------------- geometry helpers -----------------
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

function pocketBetween (cue, ball, pockets, radius) {
  const dx = ball.x - cue.x
  const dy = ball.y - cue.y
  const len = Math.hypot(dx, dy) || 1
  const nx = dx / len
  const ny = dy / len
  for (const p of pockets) {
    const t = (p.x - cue.x) * nx + (p.y - cue.y) * ny
    if (t > 0 && t < len) {
      const perp = Math.abs((p.x - cue.x) * ny - (p.y - cue.y) * nx)
      if (perp < radius * 1.5) return true
    }
  }
  return false
}

function pocketEntry (pocket, state) {
  const center = { x: state.width / 2, y: state.height / 2 }
  const dir = { x: center.x - pocket.x, y: center.y - pocket.y }
  const len = Math.hypot(dir.x, dir.y) || 1
  const offset = state.ballRadius * 1.05
  return { x: pocket.x + (dir.x / len) * offset, y: pocket.y + (dir.y / len) * offset, name: pocket.name }
}

// Returns angle between cue->ball and ball->pocket in radians
function cutAngle (cue, target, pocket) {
  const v1 = { x: target.x - cue.x, y: target.y - cue.y }
  const v2 = { x: pocket.x - target.x, y: pocket.y - target.y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag1 = Math.hypot(v1.x, v1.y)
  const mag2 = Math.hypot(v2.x, v2.y)
  const cos = Math.min(Math.max(dot / (mag1 * mag2), -1), 1)
  return Math.acos(cos)
}

// ----------------- candidate generation -----------------
function visibleOwnBalls (state, colour) {
  const cue = state.balls.find(b => b.colour === 'cue')
  const res = []
  for (const ball of state.balls) {
    if (ball.pocketed) continue
    if (ball.colour !== colour) continue
    if (pathBlocked(cue, ball, state.balls, [cue.id], state.ballRadius)) continue
    if (pocketBetween(cue, ball, state.pockets, state.ballRadius)) continue
    const crowded = state.balls.some(
      other =>
        !other.pocketed &&
        other.id !== ball.id &&
        dist(other, ball) < state.ballRadius * 2.2
    )
    if (crowded) continue
    res.push(ball)
  }
  return res
}

function generatePotCandidates (state, colour) {
  const cue = state.balls.find(b => b.colour === 'cue')
  const balls = visibleOwnBalls(state, colour)
  const shots = []
  for (const ball of balls) {
    let bestPocket = null
    let bestView = -Infinity
    let bestAngle = Infinity
    let bestDist = Infinity
    for (const pocket of state.pockets) {
      const entry = pocketEntry(pocket, state)
      if (pathBlocked(ball, entry, state.balls, [cue.id, ball.id], state.ballRadius)) continue
      const angle = cutAngle(cue, ball, entry)
      const d = dist(ball, entry)
      const view = Math.atan2(state.ballRadius * 2, d)
      if (
        view > bestView + 1e-6 ||
        (Math.abs(view - bestView) <= 1e-6 && angle < bestAngle)
      ) {
        bestView = view
        bestAngle = angle
        bestDist = d
        bestPocket = entry
      }
    }
    if (bestPocket && !pathBlocked(ball, bestPocket, state.balls, [cue.id, ball.id], state.ballRadius)) {
      const angle = bestAngle
      const distCT = dist(cue, ball)
      const distTP = bestDist
      for (const params of CUE_VARIATIONS) {
        shots.push({
          actionType: 'pot',
          targetBall: ball,
          pocket: bestPocket,
          cueParams: params,
          angle,
          distCT,
          distTP
        })
      }
    }
  }
  return shots
}

function mirrorPocket (pocket, width, height, rail) {
  switch (rail) {
    case 'left':
      return { x: -pocket.x, y: pocket.y }
    case 'right':
      return { x: width * 2 - pocket.x, y: pocket.y }
    case 'top':
      return { x: pocket.x, y: -pocket.y }
    case 'bottom':
      return { x: pocket.x, y: height * 2 - pocket.y }
    default:
      return pocket
  }
}

function generateBankPotCandidates (state, colour) {
  const cue = state.balls.find(b => b.colour === 'cue')
  const balls = visibleOwnBalls(state, colour)
  const shots = []
  for (const ball of balls) {
    for (const pocket of state.pockets) {
      for (const rail of ['left', 'right', 'top', 'bottom']) {
        const mirror = mirrorPocket(pocket, state.width, state.height, rail)
        if (pathBlocked(ball, mirror, state.balls, [cue.id, ball.id], state.ballRadius)) continue
        const entry = pocketEntry(pocket, state)
        const angle = cutAngle(cue, ball, mirror)
        const distCT = dist(cue, ball)
        const distTP = dist(ball, entry)
        for (const params of CUE_VARIATIONS) {
          shots.push({
            actionType: 'pot',
            targetBall: ball,
            pocket: entry,
            cueParams: params,
            angle,
            distCT,
            distTP,
            isBank: true,
            bankAnchor: mirror
          })
        }
      }
    }
  }
  return shots
}

function mirrorPoint (pt, width, height, rail) {
  switch (rail) {
    case 'left':
      return { x: -pt.x, y: pt.y }
    case 'right':
      return { x: width * 2 - pt.x, y: pt.y }
    case 'top':
      return { x: pt.x, y: -pt.y }
    case 'bottom':
      return { x: pt.x, y: height * 2 - pt.y }
    default:
      return pt
  }
}

function intersectionWithRail (cue, target, rail, width, height) {
  const dx = target.x - cue.x
  const dy = target.y - cue.y
  switch (rail) {
    case 'left': {
      const x = 0
      const t = (x - cue.x) / dx
      const y = cue.y + dy * t
      return { x, y }
    }
    case 'right': {
      const x = width
      const t = (x - cue.x) / dx
      const y = cue.y + dy * t
      return { x, y }
    }
    case 'top': {
      const y = 0
      const t = (y - cue.y) / dy
      const x = cue.x + dx * t
      return { x, y }
    }
    case 'bottom': {
      const y = height
      const t = (y - cue.y) / dy
      const x = cue.x + dx * t
      return { x, y }
    }
    default:
      return { x: cue.x, y: cue.y }
  }
}

function generateKickCandidates (state, colour, maxRails = 4) {
  const cue = state.balls.find(b => b.colour === 'cue')
  const balls = state.balls.filter(b => b.colour === colour && !b.pocketed)
  const shots = []
  const rails = ['left', 'right', 'top', 'bottom']
  for (const ball of balls) {
    if (!pathBlocked(cue, ball, state.balls, [cue.id, ball.id], state.ballRadius)) continue
    const queue = [{ point: ball, seq: [] }]
    const seen = new Set()
    while (queue.length > 0) {
      const { point, seq } = queue.shift()
      if (seq.length >= maxRails) continue
      for (const rail of rails) {
        const mirrored = mirrorPoint(point, state.width, state.height, rail)
        const key = `${mirrored.x},${mirrored.y},${seq.length + 1}`
        if (seen.has(key)) continue
        seen.add(key)
        const newSeq = seq.concat(rail)
        if (!pathBlocked(cue, mirrored, state.balls, [cue.id, ball.id], state.ballRadius)) {
          const anchor = intersectionWithRail(cue, mirrored, newSeq[0], state.width, state.height)
          shots.push({
            actionType: 'safety',
            targetBall: ball,
            pocket: null,
            cueParams: { speed: 'med', spin: 'stun' },
            bankAnchor: anchor,
            angle: 0,
            distCT: dist(cue, ball),
            distTP: 0
          })
        } else {
          queue.push({ point: mirrored, seq: newSeq })
        }
      }
    }
  }
  return shots
}

function generateSafeties (state, colour) {
  const cue = state.balls.find(b => b.colour === 'cue')
  const ownBalls = state.balls.filter(b => b.colour === colour && !b.pocketed)
  if (ownBalls.length === 0) return []
  // choose nearest own ball and play a gentle safety off it
  const target = ownBalls.reduce((m, b) => dist(cue, b) < dist(cue, m) ? b : m, ownBalls[0])
  return [{
    actionType: 'safety',
    targetBall: target,
    pocket: null,
    cueParams: { speed: 'soft', spin: 'stun' },
    isSafety: true,
    angle: Math.PI / 4,
    distCT: dist(cue, target),
    distTP: 0
  }]
}

// ----------------- evaluation heuristics -----------------
function estimatePotProbability (shot, state) {
  const angleDeg = shot.angle * 180 / Math.PI
  const pocketViewDeg = Math.atan2(state.ballRadius * 2, shot.distTP || 1) * 180 / Math.PI
  const cutRatio = angleDeg / (pocketViewDeg + 1e-6)
  let angleScore = 0.3
  if (cutRatio <= 1) angleScore = 0.9; else if (cutRatio <= 1.5) angleScore = 0.6
  const maxD = Math.hypot(state.width, state.height)
  const distScore = 1 - Math.min((shot.distCT + shot.distTP) / maxD, 1)
  // prioritise minimal angles for safer pots
  let P = angleScore * 0.8 + distScore * 0.2
  if (shot.isBank) P *= 0.5
  // adjust by learnt success rates
  const angleBucket = Math.round(angleDeg / 10)
  const distBucket = Math.round((shot.distTP || 0) / 50)
  const stats = shotMemory.get(`${angleBucket}:${distBucket}`)
  if (stats && stats.attempts > 0) {
    const rate = stats.success / stats.attempts
    P = (P + rate) / 2
  }
  // rail penalty
  const target = shot.targetBall
  if (target && (Math.min(target.x, state.width - target.x) < state.ballRadius * 2 || Math.min(target.y, state.height - target.y) < state.ballRadius * 2)) {
    P -= 0.1
  }
  if (state.shotsRemaining && state.shotsRemaining > 1) P += 0.05 // under pressure bonus
  // bonus for near-straight shots
  const straightBonus = Math.max(0, (10 - angleDeg) / 100)
  P += straightBonus
  // encourage cue ball to remain central after pot
  const cueAfter = simulateCueRollout(state, shot)
  const center = { x: state.width / 2, y: state.height / 2 }
  const centerScore = 1 - Math.min(dist(cueAfter, center) / maxD, 1)
  P = P * 0.9 + centerScore * 0.1
  return Math.max(0, Math.min(1, P))
}

function simulateCueRollout (state, shot) {
  const cue = state.balls.find(b => b.colour === 'cue')
  const ball = shot.targetBall
  let pos = { x: ball.x, y: ball.y }
  const toPocket = { x: shot.pocket.x - ball.x, y: shot.pocket.y - ball.y }
  const toPocketLen = Math.hypot(toPocket.x, toPocket.y) || 1
  const dirPocket = { x: toPocket.x / toPocketLen, y: toPocket.y / toPocketLen }
  const toCue = { x: ball.x - cue.x, y: ball.y - cue.y }
  const toCueLen = Math.hypot(toCue.x, toCue.y) || 1
  const dirCue = { x: toCue.x / toCueLen, y: toCue.y / toCueLen }
  switch (shot.cueParams.spin) {
    case 'followS':
      pos = { x: pos.x + dirPocket.x * 30, y: pos.y + dirPocket.y * 30 }; break
    case 'followL':
      pos = { x: pos.x + dirPocket.x * 60, y: pos.y + dirPocket.y * 60 }; break
    case 'drawS':
      pos = { x: pos.x + dirCue.x * 20, y: pos.y + dirCue.y * 20 }; break
    case 'drawL':
      pos = { x: pos.x + dirCue.x * 40, y: pos.y + dirCue.y * 40 }; break
    case 'sideL': {
      const angle = Math.atan2(dirPocket.y, dirPocket.x) - Math.PI / 12
      pos = { x: pos.x + Math.cos(angle) * 40, y: pos.y + Math.sin(angle) * 40 }; break
    }
    case 'sideR': {
      const angle = Math.atan2(dirPocket.y, dirPocket.x) + Math.PI / 12
      pos = { x: pos.x + Math.cos(angle) * 40, y: pos.y + Math.sin(angle) * 40 }; break
    }
    default: // stun
      // cue stops near target
      pos = { x: pos.x, y: pos.y }
  }
  return { x: pos.x, y: pos.y }
}

function generateFastCandidates (state, colour) {
  // only consider straight pots for nearest ball
  const cue = state.balls.find(b => b.colour === 'cue')
  const ownBalls = visibleOwnBalls(state, colour)
  if (ownBalls.length === 0) return []
  const ball = ownBalls.reduce((m, b) => dist(cue, b) < dist(cue, m) ? b : m, ownBalls[0])
  let bestPocket = null
  let bestAngle = Infinity
  let bestDist = Infinity
  let bestView = -Infinity
  for (const p of state.pockets) {
    const entry = pocketEntry(p, state)
    if (pathBlocked(ball, entry, state.balls, [cue.id, ball.id], state.ballRadius)) continue
    const angle = cutAngle(cue, ball, entry)
    const d = dist(ball, entry)
    const view = Math.atan2(state.ballRadius * 2, d)
    if (
      view > bestView + 1e-6 ||
      (Math.abs(view - bestView) <= 1e-6 && angle < bestAngle)
    ) {
      bestAngle = angle
      bestDist = d
      bestView = view
      bestPocket = entry
    }
  }
  if (!bestPocket) return []
  return [{ actionType: 'pot', targetBall: ball, pocket: bestPocket, cueParams: { speed: 'med', spin: 'stun' }, angle: bestAngle, distCT: dist(cue, ball), distTP: bestDist }]
}

function valueOfPositionAfter (nc, state, colour) {
  // simple heuristic: high if still have easy pot
  const P2 = estimatePotProbability(nc, state)
  // reward straighter follow-up shots
  const straightBonus =
    typeof nc.angle === 'number'
      ? Math.max(0, (Math.PI / 12 - nc.angle) / (Math.PI / 12)) * 0.2
      : 0
  const remaining = state.balls.filter(b => b.colour === colour && !b.pocketed).length
  const base = remaining <= 1 ? 1.2 : 0.8 // higher when nearly finishing
  const cueAfter = simulateCueRollout(state, nc)
  const center = { x: state.width / 2, y: state.height / 2 }
  const centerBonus = 0.1 * (1 - Math.min(dist(cueAfter, center) / Math.hypot(state.width, state.height), 1))
  return (P2 + straightBonus) * base + centerBonus
}

function foulRisk (shot, state) {
  // assess scratch risk and other foul tendencies such as leaving the cue
  // ball hanging over a pocket.  Experts heavily avoid these scenarios so we
  // apply a stronger penalty when detected.
  const cueAfter = simulateCueRollout(state, shot)
  let risk = 0
  if (state.pockets.some(p => dist(cueAfter, p) < state.ballRadius * 1.1)) {
    risk += 0.6
  }
  return risk
}

function riskPenalty (risk) {
  return risk // linear for simplicity
}

function safetyEV (state, colour) {
  // heuristic: leaving opponent far gives low EV for them
  const oppColour = colour === 'blue' ? 'red' : 'blue'
  const cue = state.balls.find(b => b.colour === 'cue')
  const oppBalls = state.balls.filter(b => b.colour === oppColour && !b.pocketed)
  if (oppBalls.length === 0) return 0.5
  const oppNearest = oppBalls.reduce((m, b) => dist(cue, b) < dist(cue, m) ? b : m, oppBalls[0])
  const d = dist(cue, oppNearest)
  const maxD = Math.hypot(state.width, state.height)
  return 0.3 + 0.4 * (d / maxD)
}

function evaluateCandidates (state, colour, candidates) {
  let best = null
  for (const c of candidates) {
    let EV = 0
    if (c.actionType === 'safety') {
      EV = safetyEV(state, colour)
    } else {
      const Ppot = estimatePotProbability(c, state)
      const nextState = { ...state, balls: state.balls.map(b => ({ ...b })) }
      const target = nextState.balls.find(b => b.id === c.targetBall.id)
      target.pocketed = true
      const cue = nextState.balls.find(b => b.colour === 'cue')
      const cuePos = simulateCueRollout(state, c)
      cue.x = cuePos.x; cue.y = cuePos.y
      const nextCands = generateFastCandidates(nextState, colour)
      let nextBest = 0
      for (const nc of nextCands) {
        const EV2 = valueOfPositionAfter(nc, nextState, colour)
        if (EV2 > nextBest) nextBest = EV2
      }
      const baseValue = 1
      const risk = foulRisk(c, state)
      EV = Ppot * (baseValue + nextBest) - riskPenalty(risk)
    }
    if (!best || EV > best.EV) {
      best = { c, EV }
    }
  }
  return best
}

function chooseBestAction (state, colour) {
  // Prefer direct pots with a clear path. Shots involving cushions are
  // intentionally excluded so that they are only considered if absolutely
  // nothing else is available.
  let candidates = generatePotCandidates(state, colour)
  if (candidates.length === 0) {
    const kicks = generateKickCandidates(state, colour, 4)
    if (kicks.length > 0) {
      candidates = kicks
    }
  }
  if (candidates.length === 0) {
    // No clear potting opportunity – fall back to defensive play.
    candidates = generateSafeties(state, colour)
  } else {
    const scored = candidates.map(c =>
      c.actionType === 'pot'
        ? estimatePotProbability(c, state)
        : 0
    )
    const maxPot = scored.reduce((m, p) => Math.max(m, p), 0)
    if (maxPot < 0.25) {
      candidates = candidates.concat(generateSafeties(state, colour))
    }
  }
  const STRAIGHT_THRESHOLD = Math.PI / 12 // ~15 degrees
  const straightShots = candidates.filter(
    c => typeof c.angle === 'number' && c.angle <= STRAIGHT_THRESHOLD
  )
  if (straightShots.length > 0) {
    candidates = straightShots
  }
  const best = evaluateCandidates(state, colour, candidates)
  if (!best) return null
  const c = best.c
  const cueBall = state.balls.find(b => b.colour === 'cue')
  const aim = c.bankAnchor ? { x: c.bankAnchor.x, y: c.bankAnchor.y } : (c.targetBall ? { x: c.targetBall.x, y: c.targetBall.y } : { x: cueBall.x, y: cueBall.y })
  const posTarget = c.actionType === 'safety'
    ? { x: cueBall.x, y: cueBall.y }
    : simulateCueRollout(state, c)
  return {
    actionType: c.actionType,
    targetBall: c.targetBall ? c.targetBall.colour : null,
    pocket: c.pocket ? c.pocket.name : null,
    aimPoint: aim,
    cueParams: c.cueParams,
    positionTarget: { x: posTarget.x, y: posTarget.y, radius: 40 },
    EV: best.EV,
    notes: c.actionType === 'safety' ? 'safety play' : `pot ${c.targetBall?.colour ?? ''}`,
    angle: typeof c.angle === 'number' ? c.angle : undefined,
    distToPocket: typeof c.distTP === 'number' ? c.distTP : undefined,
    targetId: c.targetBall ? c.targetBall.id : null
  }
}

// Public entry
export function selectShot (state, rules = {}) {
  let colour = state.ballOn
  if (!state.isOpenTable && colour) {
    const hasOwn = state.balls.some(b => b.colour === colour && !b.pocketed)
    if (!hasOwn) colour = 'black'
  }
  if (state.isOpenTable) {
    const planY = chooseBestAction({ ...state, ballOn: 'blue', isOpenTable: false }, 'blue')
    const planR = chooseBestAction({ ...state, ballOn: 'red', isOpenTable: false }, 'red')
    if (!planY) return planR
    if (!planR) return planY
    return planY.EV >= planR.EV ? planY : planR
  }
  return chooseBestAction(state, colour)
}

export default selectShot
