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

function normaliseColourKey (input) {
  const value = typeof input === 'string' ? input : input?.colour
  if (!value) return 'any'
  const lower = value.toLowerCase()
  if (lower.startsWith('red')) return 'red'
  if (lower.startsWith('blue') || lower.startsWith('yellow')) return 'blue'
  if (lower.startsWith('black')) return 'black'
  return lower || 'any'
}

export function recordShotOutcome (plan, success) {
  if (!plan || typeof plan.angle !== 'number' || typeof plan.distToPocket !== 'number') return
  const angleBucket = Math.round((plan.angle * 180 / Math.PI) / 10) // 10° buckets
  const distBucket = Math.round(plan.distToPocket / 50) // 50px buckets
  const colourKey = normaliseColourKey(plan?.targetBall)
  const key = `${colourKey}:${angleBucket}:${distBucket}`
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
  { speed: 'soft', spin: 'followS' },
  { speed: 'med', spin: 'followS' },
  { speed: 'firm', spin: 'followL' },
  { speed: 'soft', spin: 'followL' },
  { speed: 'med', spin: 'drawS' },
  { speed: 'firm', spin: 'drawL' },
  { speed: 'soft', spin: 'drawL' },
  { speed: 'med', spin: 'sideL' },
  { speed: 'med', spin: 'sideR' },
  { speed: 'firm', spin: 'sideL' },
  { speed: 'firm', spin: 'sideR' }
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
  return { x: pocket.x, y: pocket.y, name: pocket.name }
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

function generateKickPotCandidates (state, colour) {
  // When a direct view of the object ball is blocked, bounce off a rail to
  // take the shot instead of settling for a foul or poor safety.
  const cue = state.balls.find(b => b.colour === 'cue')
  const balls = state.balls.filter(b => b.colour === colour && !b.pocketed)
  const shots = []
  const rails = ['left', 'right', 'top', 'bottom']

  for (const ball of balls) {
    // only consider rails when the straight path is obstructed
    if (!pathBlocked(cue, ball, state.balls, [cue.id, ball.id], state.ballRadius)) continue
    for (const rail of rails) {
      const mirroredBall = mirrorPoint(ball, state.width, state.height, rail)
      if (pathBlocked(cue, mirroredBall, state.balls, [cue.id, ball.id], state.ballRadius)) continue

      const anchor = intersectionWithRail(cue, mirroredBall, rail, state.width, state.height)
      let bestPocket = null
      let bestAngle = Infinity
      let bestView = -Infinity
      let bestDist = Infinity

      for (const pocket of state.pockets) {
        const entry = pocketEntry(pocket, state)
        if (pathBlocked(ball, entry, state.balls, [cue.id, ball.id], state.ballRadius)) continue
        const angle = cutAngle(anchor, ball, entry)
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

      if (!bestPocket) continue

      for (const params of CUE_VARIATIONS) {
        shots.push({
          actionType: 'pot',
          targetBall: ball,
          pocket: bestPocket,
          cueParams: params,
          bankAnchor: anchor,
          angle: bestAngle,
          distCT: dist(cue, anchor) + dist(anchor, ball),
          distTP: bestDist,
          isKick: true
        })
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
  const maxD = Math.hypot(state.width, state.height)
  const distScore = 1 - Math.min((shot.distCT + shot.distTP) / maxD, 1)

  // sharper lines receive a steeper falloff to mimic pro precision
  const eliteStraightWindow = 0.65
  let angleScore = Math.max(0, 1 - Math.pow(Math.max(0, cutRatio - eliteStraightWindow), 1.35))

  // banks are harder; drop probability but still evaluate
  if (shot.isBank) {
    angleScore *= 0.55
  }

  // combine distance and angle with stronger emphasis on accuracy
  let P = angleScore * 0.75 + distScore * 0.25

  if (shot.isKick) {
    P *= 0.9
    P -= 0.04
  }

  // adjust by learnt success rates
  const angleBucket = Math.round(angleDeg / 7.5)
  const distBucket = Math.round((shot.distTP || 0) / 40)
  const colourKey = normaliseColourKey(shot?.targetBall)
  const stats = shotMemory.get(`${colourKey}:${angleBucket}:${distBucket}`)
  if (stats && stats.attempts > 0) {
    const rate = stats.success / Math.max(1, stats.attempts)
    P = P * 0.6 + rate * 0.4
  }

  // rail penalty and scratch awareness
  const target = shot.targetBall
  if (target && (Math.min(target.x, state.width - target.x) < state.ballRadius * 2 || Math.min(target.y, state.height - target.y) < state.ballRadius * 2)) {
    P -= 0.08
  }
  P -= foulRisk(shot, state) * 0.35

  if (state.shotsRemaining && state.shotsRemaining > 1) P += 0.05 // under pressure bonus

  // bonus for near-straight shots
  const straightBonus = Math.max(0, (12 - angleDeg) / 120)
  P += straightBonus

  // encourage cue ball to remain central after pot
  const cueAfter = simulateCueRollout(state, shot)
  const center = { x: state.width / 2, y: state.height / 2 }
  const centerScore = 1 - Math.min(dist(cueAfter, center) / maxD, 1)
  P = P * 0.85 + centerScore * 0.15
  return Math.max(0, Math.min(1, P))
}

function nextShapeWindow (state, colour) {
  const cue = state.balls.find(b => b.colour === 'cue')
  let best = 0
  const diag = Math.hypot(state.width, state.height) || 1
  for (const ball of state.balls) {
    if (ball.pocketed || ball.colour !== colour) continue
    for (const pocket of state.pockets) {
      const entry = pocketEntry(pocket, state)
      if (pathBlocked(ball, entry, state.balls, [cue.id, ball.id], state.ballRadius)) continue
      if (pathBlocked(cue, ball, state.balls, [cue.id], state.ballRadius)) continue
      const angle = cutAngle(cue, ball, entry)
      const distCT = dist(cue, ball)
      const distTP = dist(ball, entry)
      const previewShot = {
        actionType: 'pot',
        targetBall: ball,
        pocket: entry,
        cueParams: { speed: 'med', spin: 'stun' },
        angle,
        distCT,
        distTP
      }
      const prob = estimatePotProbability(previewShot, state)
      const angleWindow = Math.max(0, (Math.PI / 6 - angle) / (Math.PI / 6))
      const distanceEase = 1 - Math.min((distCT + distTP) / diag, 1)
      const score = prob * 0.6 + angleWindow * 0.3 + distanceEase * 0.1
      if (score > best) best = score
    }
  }
  return best
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
      const baseValue = 1.05
      const risk = foulRisk(c, state)
      const straightBoost = typeof c.angle === 'number' ? Math.max(0, (Math.PI / 10 - c.angle) / (Math.PI / 10)) * 0.25 : 0
      const positionWeight = 1.25
      const shapeWindow = nextShapeWindow(nextState, colour)
      EV = Ppot * (baseValue + nextBest * positionWeight + straightBoost + shapeWindow * 0.65) - riskPenalty(risk)
    }
    if (!best || EV > best.EV) {
      best = { c, EV }
    }
  }
  return best
}

function chooseBestAction (state, colour) {
  // Prefer direct pots with a clear path. Cushion-assisted pots are only
  // explored when every straight look is blocked so the AI plays bank/kick
  // shots as a last resort rather than by default.
  const directPots = generatePotCandidates(state, colour)
  let candidates = [...directPots]
  const kicks = generateKickCandidates(state, colour, 4)

  if (candidates.length === 0) {
    const bankShots = generateBankPotCandidates(state, colour)
    const kickPots = generateKickPotCandidates(state, colour)
    candidates = candidates.concat(bankShots, kickPots)
  }

  if (candidates.length === 0) {
    candidates = kicks
  }

  if (directPots.length === 0) {
    candidates = candidates.concat(generateSafeties(state, colour))
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
    if (maxPot < 0.35) {
      candidates = candidates.concat(generateSafeties(state, colour))
    }
  }
  const qualityFiltered = candidates.filter(c => {
    if (c.actionType !== 'pot') return true
    return estimatePotProbability(c, state) >= 0.2
  })
  if (qualityFiltered.length > 0) {
    candidates = qualityFiltered
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

  const translatePlan = (candidate, EV) => {
    const cueBall = state.balls.find(b => b.colour === 'cue')
    const aim = candidate.bankAnchor
      ? { x: candidate.bankAnchor.x, y: candidate.bankAnchor.y }
      : (candidate.targetBall
          ? { x: candidate.targetBall.x, y: candidate.targetBall.y }
          : { x: cueBall.x, y: cueBall.y })
    const posTarget = candidate.actionType === 'safety'
      ? { x: cueBall.x, y: cueBall.y }
      : simulateCueRollout(state, candidate)
    return {
      actionType: candidate.actionType,
      targetBall: candidate.targetBall ? candidate.targetBall.colour : null,
      pocket: candidate.pocket ? candidate.pocket.name : null,
      aimPoint: aim,
      cueParams: candidate.cueParams,
      positionTarget: { x: posTarget.x, y: posTarget.y, radius: 40 },
      EV,
      notes: candidate.actionType === 'safety' ? 'safety play' : `pot ${candidate.targetBall?.colour ?? ''}`,
      angle: typeof candidate.angle === 'number' ? candidate.angle : undefined,
      distToPocket: typeof candidate.distTP === 'number' ? candidate.distTP : undefined,
      targetId: candidate.targetBall ? candidate.targetBall.id : null
    }
  }

  let chosen = best
  if (directPots.length === 0 && best.c.actionType !== 'safety') {
    const safetyOnly = evaluateCandidates(state, colour, generateSafeties(state, colour))
    if (safetyOnly) {
      chosen = safetyOnly
    }
  }

  return translatePlan(chosen.c, chosen.EV)
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
