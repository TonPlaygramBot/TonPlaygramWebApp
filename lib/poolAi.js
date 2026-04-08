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
 * @property {{balls:Ball[],pockets:Pocket[],width:number,height:number,ballRadius:number,friction:number,myGroup?:'SOLIDS'|'STRIPES'|'UNASSIGNED',ballOn?:'blue'|'red'|null,legalBallIds?:number[],ballInHand?:boolean,mustPlayFromBaulk?:boolean,baulkLineY?:number,breakInProgress?:boolean,breakPlacementRestricted?:boolean}} state
 * @property {number} [state.cueBallId]
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
 * @property {number} [suggestedTargetBallId]
 * @property {{x:number,y:number}} [suggestedAimPoint]
 */

const LOOKAHEAD_DEPTH = 6
const LOOKAHEAD_CANDIDATES = 14
const MONTE_CARLO_BASE_SAMPLES = 128
const POWER_SCALE = 0.8
const MIN_COMPETITIVE_QUALITY = 0.16

function createRng (seed) {
  let state = (seed ?? 0) >>> 0
  return function rng () {
    state += 0x6D2B79F5
    let t = Math.imul(state ^ (state >>> 15), state | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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

function clearanceMargin (a, b, balls, ignoreIds, radius, multiplier = 1.35) {
  let min = Infinity
  for (const ball of balls) {
    if (ball.pocketed) continue
    if (ignoreIds.includes(ball.id)) continue
    const apx = ball.x - a.x
    const apy = ball.y - a.y
    const abx = b.x - a.x
    const aby = b.y - a.y
    const t = (apx * abx + apy * aby) / (abx * abx + aby * aby)
    if (t <= 0 || t >= 1) continue
    const closest = { x: a.x + abx * t, y: a.y + aby * t }
    const d = dist(closest, ball)
    if (d < min) min = d
  }
  if (!Number.isFinite(min)) return 1
  const ratio = min / (radius * multiplier)
  return Math.min(Math.max(ratio, 0), 2)
}

function scratchRiskAlongLine (cue, aimPoint, pockets, radius) {
  const dir = { x: aimPoint.x - cue.x, y: aimPoint.y - cue.y }
  const len = Math.hypot(dir.x, dir.y) || 1
  if (len <= 0) return false
  const nx = dir.x / len
  const ny = dir.y / len
  for (const p of pockets) {
    const t = (p.x - cue.x) * nx + (p.y - cue.y) * ny
    if (t <= 0 || t >= len) continue
    const perp = Math.abs((p.x - cue.x) * ny - (p.y - cue.y) * nx)
    if (perp < radius * 1.1) return true
  }
  return false
}

function pocketNormal (pocket, width, height) {
  const center = { x: width / 2, y: height / 2 }
  const dir = { x: center.x - pocket.x, y: center.y - pocket.y }
  const len = Math.hypot(dir.x, dir.y) || 1
  return { x: dir.x / len, y: dir.y / len }
}

function classifyPocket (pocket, width, height, tolerance = 1e-3) {
  const isLeft = Math.abs(pocket.x) <= tolerance
  const isRight = Math.abs(pocket.x - width) <= tolerance
  const isTop = Math.abs(pocket.y) <= tolerance
  const isBottom = Math.abs(pocket.y - height) <= tolerance

  if ((isLeft || isRight) && (isTop || isBottom)) return 'corner'
  if (isTop || isBottom) return 'side'
  return 'unknown'
}

function pocketMouthGeometry (pocket, radius, width, height, target = null) {
  const normal = pocketNormal(pocket, width, height)
  const pocketType = classifyPocket(pocket, width, height)
  const axis = { x: -normal.y, y: normal.x }
  const mouthHalfWidth = radius * (pocketType === 'side' ? 2.95 : 2.55)
  const playableHalfWidth = Math.max(radius * 0.7, mouthHalfWidth - radius * 1.08)
  const mouthCenter = {
    x: pocket.x - normal.x * radius * 1.04,
    y: pocket.y - normal.y * radius * 1.04
  }

  let lateralBias = 0
  if (target) {
    const approach = { x: pocket.x - target.x, y: pocket.y - target.y }
    const len = Math.hypot(approach.x, approach.y) || 1
    const approachUnit = { x: approach.x / len, y: approach.y / len }
    const sideProjection = approachUnit.x * axis.x + approachUnit.y * axis.y
    // Move away from the first/near jaw and bias toward the far jaw lane.
    // This helps steep cuts avoid clipping the first cushion cut.
    const jawDirection = sideProjection >= 0 ? -1 : 1
    lateralBias = jawDirection * playableHalfWidth * 0.58
  }

  return {
    normal,
    axis,
    mouthCenter,
    playableHalfWidth,
    preferredEntry: {
      x: mouthCenter.x + axis.x * lateralBias,
      y: mouthCenter.y + axis.y * lateralBias
    }
  }
}

function cornerPocketRailClearance (pocket, point, width, height) {
  const tolerance = 1e-3
  const nearLeft = Math.abs(pocket.x) <= tolerance
  const nearRight = Math.abs(pocket.x - width) <= tolerance
  const nearTop = Math.abs(pocket.y) <= tolerance
  const nearBottom = Math.abs(pocket.y - height) <= tolerance

  const xRailGap = nearLeft
    ? point.x
    : nearRight
      ? width - point.x
      : Infinity
  const yRailGap = nearTop
    ? point.y
    : nearBottom
      ? height - point.y
      : Infinity

  return Math.min(xRailGap, yRailGap)
}

function cornerPocketLaneSafety (target, entry, pocket, req) {
  if (!target || !entry || !pocket || !req?.state) return 1
  if (classifyPocket(pocket, req.state.width, req.state.height) !== 'corner') return 1
  const radius = req.state.ballRadius || 0
  const startGap = cornerPocketRailClearance(pocket, target, req.state.width, req.state.height)
  const endGap = cornerPocketRailClearance(pocket, entry, req.state.width, req.state.height)
  const laneGap = Math.min(startGap, endGap)
  const safeGap = radius * 1.45
  const hardFailGap = radius * 0.82
  if (laneGap <= hardFailGap) return 0
  return Math.max(0, Math.min((laneGap - hardFailGap) / Math.max(safeGap - hardFailGap, 1e-6), 1))
}

function pocketEntry (pocket, radius, width, height, target) {
  const mouth = pocketMouthGeometry(pocket, radius, width, height, target)
  let dir = mouth.normal

  if (target) {
    const targetDir = { x: pocket.x - target.x, y: pocket.y - target.y }
    const len = Math.hypot(targetDir.x, targetDir.y) || 1
    const unitTargetDir = { x: targetDir.x / len, y: targetDir.y / len }
    // Blend target-driven line with pocket inward normal so the AI
    // prefers hitting a central entrance trajectory instead of grazing
    // the near jaw on steep cuts.
    dir = {
      x: unitTargetDir.x * 0.62 + mouth.normal.x * 0.38,
      y: unitTargetDir.y * 0.62 + mouth.normal.y * 0.38
    }
    const blendedLen = Math.hypot(dir.x, dir.y) || 1
    dir = { x: dir.x / blendedLen, y: dir.y / blendedLen }
  }

  const offset = radius * 1.05
  const centerDriven = {
    x: pocket.x - dir.x * offset,
    y: pocket.y - dir.y * offset
  }
  const blend = target ? 0.64 : 0.4
  const entry = {
    x: centerDriven.x * (1 - blend) + mouth.preferredEntry.x * blend,
    y: centerDriven.y * (1 - blend) + mouth.preferredEntry.y * blend
  }
  if (classifyPocket(pocket, width, height) !== 'corner') return entry

  const minRailGap = radius * 0.95
  const tolerance = 1e-3
  if (Math.abs(pocket.x) <= tolerance) entry.x = Math.max(entry.x, minRailGap)
  if (Math.abs(pocket.x - width) <= tolerance) entry.x = Math.min(entry.x, width - minRailGap)
  if (Math.abs(pocket.y) <= tolerance) entry.y = Math.max(entry.y, minRailGap)
  if (Math.abs(pocket.y - height) <= tolerance) entry.y = Math.min(entry.y, height - minRailGap)
  return entry
}

function pocketAlignment (pocket, target, width, height) {
  if (!target) return 1
  const approach = { x: pocket.x - target.x, y: pocket.y - target.y }
  const len = Math.hypot(approach.x, approach.y) || 1
  const normal = pocketNormal(pocket, width, height)
  return Math.max(0, (approach.x / len) * normal.x + (approach.y / len) * normal.y)
}

function pocketEntranceOpenness (target, pocket, req) {
  if (!target || !pocket || !req?.state) return 0
  const r = req.state.ballRadius
  const mouth = pocketMouthGeometry(pocket, r, req.state.width, req.state.height, target)
  const entry = pocketEntry(pocket, r, req.state.width, req.state.height, target)
  const laneLen = Math.max(dist(target, entry), r * 2)
  const laneDir = { x: (entry.x - target.x) / laneLen, y: (entry.y - target.y) / laneLen }
  let minEdge = Infinity
  let jawLaneBlockers = 0
  for (const b of req.state.balls || []) {
    if (!b || b.pocketed || b.id === target.id) continue
    const relX = b.x - target.x
    const relY = b.y - target.y
    const along = relX * laneDir.x + relY * laneDir.y
    if (along <= 0 || along >= laneLen + r * 1.8) continue
    const lateral = Math.abs(relX * laneDir.y - relY * laneDir.x)
    const edgeGap = lateral - r * 2
    if (edgeGap < minEdge) minEdge = edgeGap

    const toMouthX = b.x - mouth.mouthCenter.x
    const toMouthY = b.y - mouth.mouthCenter.y
    const jawDepth = toMouthX * mouth.normal.x + toMouthY * mouth.normal.y
    const jawSide = Math.abs(toMouthX * mouth.axis.x + toMouthY * mouth.axis.y)
    if (jawDepth > -r * 0.6 && jawDepth < r * 2.6 && jawSide < mouth.playableHalfWidth + r * 0.5) {
      jawLaneBlockers++
    }
  }
  const clearance = Number.isFinite(minEdge)
    ? Math.max(0, Math.min((minEdge + r * 0.9) / (r * 2.2), 1))
    : 1
  const jawPenalty = Math.max(0, 1 - jawLaneBlockers * 0.28)
  const alignment = pocketAlignment(pocket, target, req.state.width, req.state.height)
  const straightness = Math.max(0, Math.min((alignment - 0.2) / 0.8, 1))
  return Math.min(1, (clearance * 0.65 + straightness * 0.35) * jawPenalty)
}

function ghostPointForTargetPocket (target, pocket, req) {
  const r = req.state.ballRadius
  const entry = pocketEntry(pocket, r, req.state.width, req.state.height, target)
  const dt = dist(target, entry)
  if (dt <= 1e-6) return null
  const ghost = {
    x: target.x - (entry.x - target.x) * (r * 2 / dt),
    y: target.y - (entry.y - target.y) * (r * 2 / dt)
  }
  if (
    ghost.x < r ||
    ghost.x > req.state.width - r ||
    ghost.y < r ||
    ghost.y > req.state.height - r
  ) {
    return null
  }
  return ghost
}

function currentGroup (state) {
  let g = state.myGroup
  if (!g || g === 'UNASSIGNED') {
    g = state.ballOn
  }
  if (!g) return undefined
  const norm = g.toString().toUpperCase()
  // In 8Ball, balls 1-7 are red (solids) and 9-15 are blue (stripes).
  // Map the textual colour assignment to the corresponding group.
  if (norm === 'RED') return 'SOLIDS'
  if (norm === 'BLUE') return 'STRIPES'
  if (norm === 'SOLIDS' || norm === 'STRIPES') return norm
  return undefined
}

function resolveCueBallId (state) {
  if (Number.isFinite(state?.cueBallId)) return state.cueBallId
  const cue = state?.balls?.find(b => b?.isCue === true)
  if (cue && Number.isFinite(cue.id)) return cue.id
  return 0
}

function inferIdFromColour (ball, indexByColour) {
  const colour = (ball?.colour || ball?.color || '').toString().toLowerCase()
  if (colour.startsWith('black')) return 8
  if (colour.startsWith('red') || colour.startsWith('solid')) {
    const next = (indexByColour.red = (indexByColour.red || 0) + 1)
    return Math.min(7, Math.max(1, next))
  }
  if (colour.startsWith('yellow') || colour.startsWith('blue') || colour.startsWith('stripe')) {
    const next = (indexByColour.yellow = (indexByColour.yellow || 0) + 1)
    return Math.min(15, Math.max(9, 8 + next))
  }
  return null
}

function resolveBallId (ball, fallback, indexByColour) {
  const candidates = [
    ball?.id,
    ball?.number,
    ball?.ballNumber,
    ball?.markerNumber,
    ball?.helperNumber,
    ball?.aiHelperNumber,
    ball?.hiddenNumber
  ]

  for (const value of candidates) {
    if (Number.isFinite(value)) return Number(value)
    if (typeof value === 'string') {
      const match = value.match(/(\d+)/)
      if (match) return Number.parseInt(match[1], 10)
    }
  }

  const inferred = inferIdFromColour(ball, indexByColour)
  if (Number.isFinite(inferred)) return inferred
  return fallback
}

function normaliseAimRequest (req) {
  const state = req?.state || {}
  const indexByColour = { red: 0, yellow: 0 }
  let fallbackId = 20
  const balls = (state.balls || []).map(ball => {
    const id = resolveBallId(ball, fallbackId++, indexByColour)
    return { ...ball, id }
  })

  const cueBall = balls.find(b => b?.isCue === true || b?.colour === 'cue' || b?.color === 'cue' || b?.id === 0)
  const cueBallId = cueBall ? cueBall.id : resolveCueBallId({ ...state, balls })

  return {
    ...req,
    state: {
      ...state,
      balls,
      cueBallId
    }
  }
}

function chooseTargets (req) {
  const cueBallId = resolveCueBallId(req.state)
  const balls = req.state.balls.filter(b => !b.pocketed && b.id !== cueBallId)
  const legalBallIds = Array.isArray(req.state.legalBallIds)
    ? req.state.legalBallIds
      .map(value => Number(value))
      .filter(Number.isFinite)
    : []
  if (legalBallIds.length > 0) {
    const legalTargets = balls.filter(ball => legalBallIds.includes(ball.id))
    if (legalTargets.length > 0) return legalTargets
  }
  if (req.game === 'NINE_BALL') {
    const lowest = balls.reduce((m, b) => (b.id < m.id ? b : m), balls[0])
    return lowest ? [lowest] : []
  }
  if (req.game === 'AMERICAN_BILLIARDS') {
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
    return balls
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
    const openTargets = balls.filter(b => b.id !== 8)
    if (openTargets.length === 0) {
      const eight = balls.find(b => b.id === 8)
      return eight ? [eight] : []
    }
    return openTargets
  }
  return balls
}

function nextTargetsAfter (targetId, req) {
  const cueBallId = resolveCueBallId(req.state)
  const cloned = req.state.balls.filter(b => !b.pocketed && b.id !== targetId && b.id !== cueBallId)
  const legalBallIds = Array.isArray(req.state.legalBallIds)
    ? req.state.legalBallIds
      .map(value => Number(value))
      .filter(Number.isFinite)
      .filter(id => id !== targetId)
    : []
  if (legalBallIds.length > 0) {
    const legalTargets = cloned.filter(ball => legalBallIds.includes(ball.id))
    if (legalTargets.length > 0) return legalTargets
  }
  if (req.game === 'NINE_BALL') {
    if (cloned.length === 0) return []
    const lowest = cloned.reduce((m, b) => (b.id < m.id ? b : m), cloned[0])
    return lowest ? [lowest] : []
  }
  if (req.game === 'AMERICAN_BILLIARDS') {
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
    return cloned
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
    const openTargets = cloned.filter(b => b.id !== 8)
    if (openTargets.length === 0) {
      const eight = cloned.find(b => b.id === 8)
      return eight ? [eight] : []
    }
    return openTargets
  }
  return cloned
}

// Identify target/pocket pairs that satisfy core aiming criteria:
// minimal cut angle and clear pocket entry. Returns sorted candidates,
// preferring smaller cut angles and wider pocket views.
function clearShotCandidates (req) {
  const r = req.state.ballRadius
  const cueBallId = resolveCueBallId(req.state)
  const cue = req.state.balls.find(b => b.id === cueBallId)
  const targets = chooseTargets(req)
  const pockets = req.state.pockets
  const maxCut = req.maxCutAngle ?? Math.PI / 4.15
  const minView = req.minViewScore ?? 0.42
  const candidates = []

  for (const target of targets) {
    for (const pocket of pockets) {
      const entry = pocketEntry(pocket, r, req.state.width, req.state.height, target)
      const ghost = ghostPointForTargetPocket(target, pocket, req)
      if (!ghost) continue

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
        pathBlocked(cue, ghost, req.state.balls, [cueBallId, target.id], r, 1.1) ||
        pathBlocked(target, entry, req.state.balls, [cueBallId, target.id], r) ||
        req.state.balls.some(
          b => b.id !== cueBallId && b.id !== target.id && !b.pocketed && dist(b, entry) < r * 1.1
        )
      ) {
        continue
      }

      const shotVec = { x: target.x - cue.x, y: target.y - cue.y }
      const potVec = { x: entry.x - target.x, y: entry.y - target.y }
      let cut = Math.abs(Math.atan2(potVec.y, potVec.x) - Math.atan2(shotVec.y, shotVec.x))
      if (cut > Math.PI) cut = Math.abs(cut - Math.PI * 2)
      const entryDistance = dist(target, entry)
      const viewAngle = Math.atan2(r * 2, entryDistance)
      const viewScore = Math.min(viewAngle / (Math.PI / 2), 1)
      const entryAlignment = pocketAlignment(pocket, target, req.state.width, req.state.height)
      const weightedView = viewScore * (0.7 + 0.3 * entryAlignment)
      const entranceOpenness = pocketEntranceOpenness(target, pocket, req)
      const pocketView = weightedView * (0.68 + 0.32 * entranceOpenness)
      const cornerLaneSafety = cornerPocketLaneSafety(target, entry, pocket, req)
      const approachStraightness = 1 - Math.min(cut / (Math.PI / 2), 1)
      const cueToTarget = cue ? dist(cue, target) : 0
      const distanceScore = cue ? Math.max(0, 1 - cueToTarget / (r * 60)) : 0
      const pocketTravelPenalty = Math.min(entryDistance / (r * 28), 1)
      const rank =
        pocketView * 0.52 +
        approachStraightness * 0.31 +
        distanceScore * 0.08 +
        cornerLaneSafety * 0.19 +
        entranceOpenness * 0.17 -
        pocketTravelPenalty * 0.08

      // require fairly central hit and open pocket view
      if (cut <= maxCut && pocketView >= minView && cornerLaneSafety >= 0.3) {
        candidates.push({ target, pocket, cut, view: pocketView, rank })
      }
    }
  }

  candidates.sort((a, b) => b.rank - a.rank || a.cut - b.cut || b.view - a.view)
  return candidates
}

function findSuggestedTarget (req, primaryTargetId = null) {
  const cueBallId = resolveCueBallId(req.state)
  const cue = req.state.balls.find(b => b.id === cueBallId)
  if (!cue) return null
  const ranked = clearShotCandidates(req)
  const fallbackPool = ranked.length > 0
    ? ranked
    : chooseTargets(req).flatMap(target => req.state.pockets.map(pocket => ({ target, pocket, rank: 0 })))
  for (const candidate of fallbackPool) {
    const targetId = candidate?.target?.id
    if (!Number.isFinite(targetId)) continue
    if (primaryTargetId != null && targetId === primaryTargetId) continue
    const ghost = ghostPointForTargetPocket(candidate.target, candidate.pocket, req)
    if (!ghost) continue
    if (pathBlocked(cue, ghost, req.state.balls, [cueBallId, targetId], req.state.ballRadius, 1.1)) continue
    return {
      suggestedTargetBallId: targetId,
      suggestedAimPoint: ghost
    }
  }
  return null
}

export function estimateCueAfterShot (cue, target, pocket, power, spin, table) {
  const toTarget = { x: target.x - cue.x, y: target.y - cue.y }
  const toPocket = { x: pocket.x - target.x, y: pocket.y - target.y }
  const shotLen = Math.hypot(toTarget.x, toTarget.y) || 1
  const objectLen = Math.hypot(toPocket.x, toPocket.y) || 1
  const shotDir = { x: toTarget.x / shotLen, y: toTarget.y / shotLen }
  const objectDir = { x: toPocket.x / objectLen, y: toPocket.y / objectLen }
  const stunDirRaw = { x: shotDir.x - objectDir.x, y: shotDir.y - objectDir.y }
  const stunLen = Math.hypot(stunDirRaw.x, stunDirRaw.y) || 1
  const stunDir = { x: stunDirRaw.x / stunLen, y: stunDirRaw.y / stunLen }

  const cutDot = Math.max(-1, Math.min(1, shotDir.x * objectDir.x + shotDir.y * objectDir.y))
  const cutSeverity = Math.sqrt(Math.max(0, 1 - cutDot * cutDot))
  const tableRadius = Number.isFinite(table?.ballRadius) ? table.ballRadius : 10
  const baseTravel = Math.max(tableRadius * 3, power * tableRadius * (18 - 3.6 * cutSeverity))

  // Stun component (natural tangent line), then follow/draw layered on top.
  const followAmount = Math.max(0, spin.top || 0)
  const drawAmount = Math.max(0, spin.back || 0)
  const travelScale = 1 + followAmount * 0.62 - drawAmount * (0.55 + cutSeverity * 0.25)
  const result = {
    x: target.x + stunDir.x * baseTravel * travelScale,
    y: target.y + stunDir.y * baseTravel * travelScale
  }

  if (drawAmount > 1e-4) {
    const drawTravel = baseTravel * drawAmount * (0.42 + 0.48 * (1 - cutSeverity))
    result.x -= shotDir.x * drawTravel
    result.y -= shotDir.y * drawTravel
  }

  // Side spin keeps existing sign convention while scaling with power and cut.
  const sideUnit = { x: -stunDir.y, y: stunDir.x }
  const tableScale = Math.max(table.width, table.height) * 0.045
  const sideFactor = (1 - cutSeverity) * 0.3 + 0.7
  const sideOffset = (spin.side || 0) * power * tableScale * sideFactor
  result.x += sideUnit.x * sideOffset
  result.y += sideUnit.y * sideOffset

  return result
}

function recommendedPowerForPot (cue, target, entry, cutAngle, req, options = {}) {
  const r = Math.max(req?.state?.ballRadius || 0, 1)
  const tableDiag = Math.hypot(req.state.width, req.state.height) || 1
  const cueToTarget = dist(cue, target)
  const targetToPocket = dist(target, entry)
  const travelNorm = Math.min((cueToTarget * 0.6 + targetToPocket * 0.85) / (tableDiag * 0.72), 1)
  const cutSeverity = Math.min(Math.abs(cutAngle) / (Math.PI / 2), 1)
  const base = 0.37 + travelNorm * 0.35 + cutSeverity * 0.16
  const pocketTightness = Math.min(targetToPocket / (r * 30), 1)
  const controlOffset = pocketTightness * 0.06
  let recommended = Math.max(0.36, Math.min(0.92, base + controlOffset))

  const desiredCueAfter = options?.desiredCueAfter
  if (desiredCueAfter && Number.isFinite(desiredCueAfter.x) && Number.isFinite(desiredCueAfter.y)) {
    const neutralCueAfter = estimateCueAfterShot(
      cue,
      target,
      entry,
      recommended * POWER_SCALE,
      options?.spin || { top: 0, side: 0, back: 0 },
      req.state
    )
    const currentError = dist(neutralCueAfter, desiredCueAfter)
    const normalizer = Math.max(Math.hypot(req.state.width, req.state.height) * 0.36, r * 24)
    const errorRatio = Math.min(currentError / normalizer, 1)
    if (errorRatio > 0.2) {
      recommended += Math.min(0.12, errorRatio * 0.18)
    } else {
      recommended -= Math.min(0.08, (0.2 - errorRatio) * 0.22)
    }
  }
  return Math.max(0.34, Math.min(0.95, recommended)) * POWER_SCALE
}

function projectedScratchRisk (cueAfter, req) {
  const r = req.state.ballRadius
  const closeToPocket = (req.state.pockets || []).some(p => dist(cueAfter, p) < r * 1.35)
  if (closeToPocket) return 1
  let worst = 0
  for (const pocket of (req.state.pockets || [])) {
    const d = dist(cueAfter, pocket)
    const score = Math.max(0, 1 - d / (r * 14))
    if (score > worst) worst = score
  }
  return Math.min(worst, 1)
}

function mirrorPointAcrossRail (point, rail, state) {
  switch (rail) {
    case 'left': return { x: -point.x, y: point.y }
    case 'right': return { x: state.width * 2 - point.x, y: point.y }
    case 'top': return { x: point.x, y: -point.y }
    case 'bottom': return { x: point.x, y: state.height * 2 - point.y }
    default: return null
  }
}

function firstRailContact (cue, mirroredTarget, rail, state) {
  const dx = mirroredTarget.x - cue.x
  const dy = mirroredTarget.y - cue.y
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null
  if (rail === 'left' || rail === 'right') {
    const xRail = rail === 'left' ? 0 : state.width
    if (Math.abs(dx) < 1e-6) return null
    const t = (xRail - cue.x) / dx
    if (t <= 0 || t >= 1) return null
    const y = cue.y + dy * t
    if (y <= 0 || y >= state.height) return null
    return { x: xRail, y }
  }
  const yRail = rail === 'top' ? 0 : state.height
  if (Math.abs(dy) < 1e-6) return null
  const t = (yRail - cue.y) / dy
  if (t <= 0 || t >= 1) return null
  const x = cue.x + dx * t
  if (x <= 0 || x >= state.width) return null
  return { x, y: yRail }
}

function oneCushionKickShot (req) {
  const cueBallId = resolveCueBallId(req.state)
  const cue = req.state.balls.find(b => b.id === cueBallId)
  if (!cue) return null
  const legalTargets = chooseTargets(req)
  if (!legalTargets.length) return null
  const rails = ['left', 'right', 'top', 'bottom']
  let best = null
  for (const target of legalTargets) {
    for (const rail of rails) {
      const mirrored = mirrorPointAcrossRail(target, rail, req.state)
      if (!mirrored) continue
      const cushion = firstRailContact(cue, mirrored, rail, req.state)
      if (!cushion) continue
      if (pathBlocked(cue, cushion, req.state.balls, [cueBallId], req.state.ballRadius, 1.05)) continue
      if (pathBlocked(cushion, target, req.state.balls, [cueBallId, target.id], req.state.ballRadius, 1.05)) continue
      const distance = dist(cue, cushion) + dist(cushion, target)
      const tableDiag = Math.hypot(req.state.width, req.state.height) || 1
      const difficulty = Math.min(distance / (tableDiag * 1.2), 1)
      const candidate = {
        angleRad: Math.atan2(cushion.y - cue.y, cushion.x - cue.x),
        power: Math.max(0.48 * POWER_SCALE, Math.min(0.84 * POWER_SCALE, (0.46 + difficulty * 0.36) * POWER_SCALE)),
        spin: { top: 0, side: 0, back: 0.08 },
        targetBallId: target.id,
        aimPoint: cushion,
        quality: 0.28 - difficulty * 0.18,
        rationale: `one-cushion-kick rail=${rail} target=${target.id}`
      }
      if (!best || candidate.quality > best.quality) best = candidate
    }
  }
  return best
}

function clampPointToTable (point, table, margin = 1) {
  if (!table) return { ...point }
  const inset = (table.ballRadius || 0) * margin
  const clampedX = Math.min(Math.max(point.x, inset), table.width - inset)
  const clampedY = Math.min(Math.max(point.y, inset), table.height - inset)
  return { x: clampedX, y: clampedY }
}

function cloneBallsForNextShot (balls, cueAfter, targetId, state) {
  const cueBallId = resolveCueBallId(state)
  const clamped = clampPointToTable(cueAfter, state, 1.1)
  return balls.map(ball => {
    const next = { ...ball }
    if (next.id === targetId) {
      next.pocketed = true
    }
    if (next.id === cueBallId) {
      next.x = clamped.x
      next.y = clamped.y
      next.vx = 0
      next.vy = 0
    }
    return next
  })
}

// Rough Monte Carlo estimate of potting probability by jittering the cue
// aim slightly and checking if paths remain clear. This models human
// imprecision and rewards shorter, straighter shots.
function monteCarloPotChance (req, cue, target, entry, ghost, balls, samples = 20, rng = Math.random) {
  const r = req.state.ballRadius
  const cueBallId = resolveCueBallId(req.state)
  const baseAngle = Math.atan2(ghost.y - cue.y, ghost.x - cue.x)
  const distCG = dist(cue, ghost)
  const shotLength = dist(cue, target)
  const distanceFactor = Math.min(shotLength / (r * 20 || 1), 2)
  const sampleCount = Math.max(samples, Math.round(MONTE_CARLO_BASE_SAMPLES * (1 + distanceFactor * 1.2)))
  const jitterScale = 0.008 + 0.015 * distanceFactor
  let success = 0
  for (let i = 0; i < sampleCount; i++) {
    const a = baseAngle + (rng() - 0.5) * jitterScale
    const g = { x: cue.x + Math.cos(a) * distCG, y: cue.y + Math.sin(a) * distCG }
    if (
      g.x < r ||
      g.x > req.state.width - r ||
      g.y < r ||
      g.y > req.state.height - r
    ) continue
    if (pathBlocked(cue, g, balls, [cueBallId, target.id], r, 1.1)) continue
    if (pathBlocked(target, entry, balls, [cueBallId, target.id], r)) continue
    // if jitter deviates too far from ideal contact, treat as miss
    if (dist(g, ghost) > r * 0.42) continue
    success++
  }
  return success / sampleCount
}

function estimateRunoutPotential (req, cueAfter, targetId, balls, depth = 1, rng = Math.random) {
  if (!req?.state || depth <= 0) return 0
  const cueBallId = resolveCueBallId(req.state)
  const nextBalls = cloneBallsForNextShot(balls, cueAfter, targetId, req.state)
  const nextReq = { ...req, state: { ...req.state, balls: nextBalls, ballInHand: false } }
  const cue = nextBalls.find(b => b.id === cueBallId)
  if (!cue) return 0
  const candidates = clearShotCandidates(nextReq)
  if (!candidates.length) return 0
  let best = 0
  for (const { target, pocket } of candidates.slice(0, LOOKAHEAD_CANDIDATES)) {
    const preview = evaluate(
      nextReq,
      cue,
      target,
      pocket,
      0.7,
      { top: 0, side: 0, back: 0 },
      nextBalls,
      true,
      { skipLookahead: true, rng }
    )
    if (!preview) continue
    let score = preview.quality
    if (depth > 1) {
      const entry = pocketEntry(pocket, req.state.ballRadius, req.state.width, req.state.height, target)
      const nextCueAfter = estimateCueAfterShot(
        cue,
        target,
        entry,
        preview.power ?? 0.7,
        preview.spin ?? { top: 0, side: 0, back: 0 },
        req.state
      )
      const follow = estimateRunoutPotential(nextReq, nextCueAfter, target.id, nextBalls, depth - 1, rng)
      score = Math.max(score, (score + follow) / 2)
    }
    best = Math.max(best, score)
  }
  return best
}

function resolveDesiredCueAfter (req, target, cueAfterBase) {
  const nextTargets = nextTargetsAfter(target.id, req)
  if (!nextTargets.length) return null
  const next = nextTargets
    .slice()
    .sort((a, b) => dist(a, cueAfterBase) - dist(b, cueAfterBase))[0]
  if (!next) return null
  return { x: next.x, y: next.y, id: next.id }
}

function positionalErrorForNextShot (req, target, cueAfter) {
  const nextTargets = nextTargetsAfter(target.id, req)
  if (!nextTargets.length) return 0
  const d = nextTargets.reduce((min, b) => Math.min(min, dist(cueAfter, b)), Infinity)
  const scale = Math.max(Math.hypot(req.state.width, req.state.height) * 0.26, req.state.ballRadius * 18)
  return Math.min(d / scale, 1)
}

function calibrateSpinSideForNextBall (req, cue, target, pocket, spin, power) {
  const entry = pocketEntry(pocket, req.state.ballRadius, req.state.width, req.state.height, target)
  const nextNeutral = estimateCueAfterShot(cue, target, entry, power, { ...spin, side: 0 }, req.state)
  const desiredCueAfter = resolveDesiredCueAfter(req, target, nextNeutral)
  if (!desiredCueAfter) return spin

  const sideAmplitude = Math.abs(spin.side || 0)
  if (sideAmplitude < 0.04) return spin
  const sideSigns = [Math.sign(spin.side || 0) || 1, -1]
  let best = { spin, error: Infinity, scratch: Infinity }
  for (const sign of sideSigns) {
    const trialSpin = { ...spin, side: sideAmplitude * sign }
    const cueAfter = estimateCueAfterShot(cue, target, entry, power, trialSpin, req.state)
    const error = dist(cueAfter, desiredCueAfter)
    const scratch = projectedScratchRisk(cueAfter, req)
    if (error + scratch * req.state.ballRadius * 24 < best.error + best.scratch * req.state.ballRadius * 24) {
      best = { spin: trialSpin, error, scratch }
    }
  }
  return best.spin
}


function buildSpinCandidates (cue, target, pocket, req) {
  const base = [
    { top: 0, side: 0, back: 0 },
    { top: 0.28, side: 0, back: 0 },
    { top: 0, side: 0, back: 0.28 },
    { top: 0.22, side: 0.2, back: 0 },
    { top: 0.22, side: -0.2, back: 0 }
  ]
  const nextTargets = nextTargetsAfter(target.id, req)
  if (!nextTargets.length) return base

  const entry = pocketEntry(pocket, req.state.ballRadius, req.state.width, req.state.height, target)
  const naturalCueAfter = estimateCueAfterShot(cue, target, entry, 0.7, { top: 0, side: 0, back: 0 }, req.state)
  const next = nextTargets
    .slice()
    .sort((a, b) => dist(a, naturalCueAfter) - dist(b, naturalCueAfter))[0]
  if (!next) return base

  const toNext = { x: next.x - naturalCueAfter.x, y: next.y - naturalCueAfter.y }
  const shotDir = { x: entry.x - target.x, y: entry.y - target.y }
  const shotLen = Math.hypot(shotDir.x, shotDir.y) || 1
  const sideUnit = { x: -shotDir.y / shotLen, y: shotDir.x / shotLen }
  const sideProjection = (toNext.x * sideUnit.x + toNext.y * sideUnit.y) / Math.max(req.state.ballRadius * 20, 1)
  const forwardProjection = (toNext.x * shotDir.x + toNext.y * shotDir.y) / Math.max(shotLen * req.state.ballRadius * 12, 1)

  const adaptive = {
    top: Math.max(-0.35, Math.min(0.35, forwardProjection > 0 ? 0.1 + forwardProjection : 0.05)),
    back: Math.max(0, Math.min(0.35, forwardProjection < -0.04 ? -forwardProjection : 0)),
    side: Math.max(-0.35, Math.min(0.35, sideProjection))
  }
  adaptive.top = Math.max(0, adaptive.top - adaptive.back)
  const calibratedAdaptive = calibrateSpinSideForNextBall(req, cue, target, pocket, adaptive, 0.68 * POWER_SCALE)

  return [calibratedAdaptive, adaptive, ...base]
}

function evaluate (req, cue, target, pocket, power, spin, ballsOverride, strict = false, options = {}) {
  const r = req.state.ballRadius
  const cueBallId = resolveCueBallId(req.state)
  const rng = options.rng ?? Math.random
  const balls = ballsOverride || req.state.balls
  const entry = pocketEntry(pocket, r, req.state.width, req.state.height, target)
  const ghost = ghostPointForTargetPocket(target, pocket, req)
  if (!ghost) return null
  // if ghost lies outside playable area, shot is impossible
  if (
    ghost.x < r ||
    ghost.x > req.state.width - r ||
    ghost.y < r ||
    ghost.y > req.state.height - r
  ) {
    return null
  }
  const laneClearance = clearanceMargin(cue, target, balls, [cueBallId, target.id], r, 1.3)
  if (laneClearance < 0.5) {
    return null
  }
  if (scratchRiskAlongLine(cue, ghost, req.state.pockets || [], r)) {
    return null
  }
  if (
    pathBlocked(cue, ghost, balls, [cueBallId, target.id], r, 1.1) ||
    pathBlocked(target, entry, balls, [cueBallId, target.id], r) ||
    balls.some(b => b.id !== cueBallId && b.id !== target.id && !b.pocketed && dist(b, entry) < r * 1.1)
  ) {
    return null
  }
  const maxD = Math.hypot(req.state.width, req.state.height)
  const mcSamples = Number.isFinite(options.mcSamples)
    ? Math.max(24, Math.round(options.mcSamples))
    : 20
  const potChance = monteCarloPotChance(req, cue, target, entry, ghost, balls, mcSamples, rng)
  const minPotChance = strict ? 0.2 : 0.1
  if (potChance < minPotChance) return null
  const cueAfter = estimateCueAfterShot(cue, target, entry, power, spin, req.state)
  const scratchAfterImpact = scratchRiskAlongLine(target, cueAfter, req.state.pockets || [], r)
  if (strict && scratchAfterImpact) {
    return null
  }
  const nextTargets = nextTargetsAfter(target.id, { ...req, state: { ...req.state, balls } })
  let nextScore = 0
  let hasNext = false
  if (nextTargets.length > 0) {
    hasNext = true
    let bestShape = 0
    for (const next of nextTargets.slice(0, 4)) {
      const cueDistanceScore = 1 - Math.min(dist(cueAfter, next) / maxD, 1)
      let nextPocketAlign = 0
      for (const nextPocket of req.state.pockets) {
        nextPocketAlign = Math.max(nextPocketAlign, pocketAlignment(nextPocket, next, req.state.width, req.state.height))
      }
      const shape = 0.56 * cueDistanceScore + 0.44 * nextPocketAlign
      if (shape > bestShape) bestShape = shape
    }
    nextScore = bestShape
  }
  const risk = req.state.pockets.some(p => dist(cueAfter, p) < r * 1.2) ? 1 : 0
  const shotVec = { x: target.x - cue.x, y: target.y - cue.y }
  const potVec = { x: entry.x - target.x, y: entry.y - target.y }
  let cutAngle = Math.abs(Math.atan2(potVec.y, potVec.x) - Math.atan2(shotVec.y, shotVec.x))
  if (cutAngle > Math.PI) cutAngle = Math.abs(cutAngle - Math.PI * 2)
  const centerAlign = 1 - Math.min(cutAngle / (Math.PI / 2), 1)
  const nearHole = 1 - Math.min(dist(target, entry) / (r * 20), 1)
  const viewAngle = Math.atan2(r * 2, dist(target, entry))
  const viewScore = Math.min(viewAngle / (Math.PI / 2), 1)
  const entryAlignment = pocketAlignment(pocket, target, req.state.width, req.state.height)
  const pocketOpen = viewScore * (0.7 + 0.3 * entryAlignment)
  const cornerLaneSafety = cornerPocketLaneSafety(target, entry, pocket, req)
  if (cornerLaneSafety <= 0.1) {
    return null
  }
  const cueToTarget = dist(cue, target)
  const shotLengthFactor = Math.min(cueToTarget / (r * 40), 2)
  const cutSeverity = Math.min(cutAngle / (Math.PI / 2), 1)
  const desiredCueAfter = resolveDesiredCueAfter(req, target, cueAfter)
  const recommendedPower = recommendedPowerForPot(cue, target, entry, cutAngle, req, {
    desiredCueAfter,
    spin
  })
  const powerDeviation = Math.abs(power - recommendedPower) / Math.max(0.25 * POWER_SCALE, 1e-6)
  const pocketTightness = 1 - pocketOpen
  const difficultyPenalty = 0.25 * (0.5 * cutSeverity + 0.3 * shotLengthFactor + 0.2 * pocketTightness)
  const spinPenalty =
    Math.abs(spin.side || 0) * 0.06 +
    Math.max(0, spin.back || 0) * 0.12 +
    Math.max(0, spin.top || 0) * 0.04
  const powerControlPenalty =
    Math.max(0, power - (0.5 * POWER_SCALE)) * 0.24 +
    Math.max(0, powerDeviation - 0.12) * 0.2
  const clearanceScore = Math.max(0, Math.min((laneClearance - 0.5) / 0.7, 1))
  if (strict && (centerAlign < 0.5 || pocketOpen < 0.3)) {
    return null
  }
  const lookaheadDepth = Number.isFinite(options.lookaheadDepth)
    ? Math.max(0, options.lookaheadDepth)
    : LOOKAHEAD_DEPTH
  const monteCarloRunout = potChance
  const runoutPotential = options.skipLookahead
    ? 0
    : estimateRunoutPotential(req, cueAfter, target.id, balls, lookaheadDepth, rng)
  const scratchProjection = projectedScratchRisk(cueAfter, req)
  const positionalError = positionalErrorForNextShot(req, target, cueAfter)
  const quality = Math.max(
    0,
    Math.min(
      1,
      0.46 * potChance +
        0.15 * pocketOpen +
        0.13 * centerAlign +
        0.1 * cornerLaneSafety +
        0.06 * nextScore +
        0.03 * nearHole +
        0.14 * runoutPotential +
        0.11 * clearanceScore -
        positionalError * 0.1 -
        0.21 * risk -
        scratchProjection * 0.18 -
        (scratchAfterImpact ? 0.2 : 0) -
        spinPenalty -
        powerControlPenalty -
        difficultyPenalty
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
    rationale: `target=${target.id} pocket=(${pocket.x.toFixed(0)},${pocket.y.toFixed(0)}) angle=${angle.toFixed(2)} power=${power.toFixed(2)} spin=${spin.top.toFixed(2)},${spin.side.toFixed(2)},${spin.back.toFixed(2)} pc=${potChance.toFixed(2)} ca=${centerAlign.toFixed(2)} nh=${nearHole.toFixed(2)} np=${nextScore.toFixed(2)} mcr=${monteCarloRunout.toFixed(2)} pe=${positionalError.toFixed(2)} r=${risk.toFixed(2)}`,
    nextScore,
    hasNext
  }
}

function safetyShot (req) {
  const cueBallId = resolveCueBallId(req.state)
  const cue = req.state.balls.find(b => b.id === cueBallId)
  const oneCushion = oneCushionKickShot(req)
  if (oneCushion) return oneCushion
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
    power: 0.5 * POWER_SCALE,
    spin: { top: 0, side: 0, back: 0 },
    quality: 0,
    rationale: 'safety-distance'
  }
}

function fallbackAimAtTarget (req) {
  const cueBallId = resolveCueBallId(req.state)
  const cue = req.state.balls.find(b => b.id === cueBallId)
  const targets = chooseTargets(req)
  if (!cue || targets.length === 0) return null

  let best = null
  for (const target of targets) {
    let bestPocket = null
    let bestAlign = -Infinity
    for (const pocket of req.state.pockets) {
      const align = pocketAlignment(pocket, target, req.state.width, req.state.height)
      if (align > bestAlign) {
        bestAlign = align
        bestPocket = pocket
      }
    }
    if (!bestPocket) continue
    const entry = pocketEntry(bestPocket, req.state.ballRadius, req.state.width, req.state.height, target)
    const ghost = {
      x: target.x - (entry.x - target.x) * (req.state.ballRadius * 2 / dist(target, entry)),
      y: target.y - (entry.y - target.y) * (req.state.ballRadius * 2 / dist(target, entry))
    }
    if (
      ghost.x < req.state.ballRadius ||
      ghost.x > req.state.width - req.state.ballRadius ||
      ghost.y < req.state.ballRadius ||
      ghost.y > req.state.height - req.state.ballRadius
    ) {
      continue
    }
    const angle = Math.atan2(ghost.y - cue.y, ghost.x - cue.x)
    const candidate = {
      angleRad: angle,
      power: 0.65 * POWER_SCALE,
      spin: { top: 0, side: 0, back: 0 },
      targetBallId: target.id,
      targetPocket: bestPocket,
      aimPoint: ghost,
      quality: 0,
      rationale: 'fallback-aim'
    }
    if (!best || bestAlign > best.align) {
      best = { ...candidate, align: bestAlign }
    }
  }

  if (!best) return null
  const { align: _align, ...rest } = best
  return rest
}

function isBetterShotCandidate (candidate, currentBest) {
  if (!currentBest) return true
  const qualityDelta = candidate.quality - currentBest.quality
  if (qualityDelta > 0.012) return true
  if (qualityDelta < -0.012) return false

  const candSpinLoad = Math.abs(candidate.spin?.side || 0) + Math.abs(candidate.spin?.top || 0) + Math.abs(candidate.spin?.back || 0)
  const bestSpinLoad = Math.abs(currentBest.spin?.side || 0) + Math.abs(currentBest.spin?.top || 0) + Math.abs(currentBest.spin?.back || 0)
  if (candSpinLoad + 0.03 < bestSpinLoad) return true
  if (candSpinLoad > bestSpinLoad + 0.03) return false

  return candidate.power < currentBest.power
}

/**
 * @param {AimRequest} req
 * @returns {ShotDecision}
 */
export function planShot (req) {
  req = normaliseAimRequest(req)
  const r = req.state.ballRadius
  const cueBallId = resolveCueBallId(req.state)
  const start = Date.now()
  const deadline = req.timeBudgetMs ? start + req.timeBudgetMs : Infinity
  const thinkingBudget = Number.isFinite(req.timeBudgetMs) ? Math.max(120, req.timeBudgetMs) : 700
  const budgetScale = Math.min(2.4, Math.max(0.7, thinkingBudget / 700))
  const lookaheadDepth = Math.max(4, Math.min(8, Math.round(LOOKAHEAD_DEPTH * budgetScale)))
  const mcSamples = Math.max(48, Math.min(220, Math.round(MONTE_CARLO_BASE_SAMPLES * budgetScale)))
  const rng = Number.isFinite(req.rngSeed) ? createRng(req.rngSeed) : Math.random
  let best = null
  let fallback = null
  let hasViableShot = false

  const powers = req.state?.breakInProgress
    ? [1 * POWER_SCALE]
    : [0.5 * POWER_SCALE, 0.66 * POWER_SCALE, 0.82 * POWER_SCALE, 0.94 * POWER_SCALE]
  const defaultSpins = [
    { top: 0, side: 0, back: 0 },
    { top: 0.3, side: 0, back: 0 },
    { top: 0, side: 0, back: 0.3 },
    { top: 0.2, side: 0.3, back: 0 },
    { top: 0.2, side: -0.3, back: 0 }
  ]

  // first, gather candidate target/pocket pairs meeting strict criteria
  let candidatePairs = clearShotCandidates(req)
  if (candidatePairs.length === 0) {
    // fallback: evaluate all target/pocket combinations
    const pockets = req.state.pockets
    const targets = chooseTargets(req)
    candidatePairs = targets.flatMap(t => pockets.map(p => ({ target: t, pocket: p })))
  } else {
    candidatePairs = candidatePairs.slice(0, Math.min(candidatePairs.length, 18))
  }

  for (const strict of [true, false]) {
    for (const { target, pocket } of candidatePairs) {
      const entry = pocketEntry(pocket, r, req.state.width, req.state.height, target)
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
          const breakPlacementRestricted = Boolean(
            req.state.breakPlacementRestricted ?? req.state.breakInProgress
          )
          if (
            req.state.mustPlayFromBaulk &&
            breakPlacementRestricted &&
            typeof req.state.baulkLineY === 'number' &&
            cand.y < req.state.baulkLineY
          ) {
            continue
          }
          const overlap = req.state.balls.some(
            b => b.id !== cueBallId && !b.pocketed && dist(cand, b) < r * 2
          )
          if (overlap) continue
          placements.push(cand)
        }
      } else {
        const cue = req.state.balls.find(b => b.id === cueBallId)
        placements.push({ x: cue.x, y: cue.y })
      }

      for (const cuePos of placements) {
        const balls = req.state.balls.map(b =>
          b.id === cueBallId ? { ...b, x: cuePos.x, y: cuePos.y } : b
        )

        const baseCand = evaluate(
          req,
          cuePos,
          target,
          pocket,
          powers[0],
          defaultSpins[0],
          balls,
          strict,
          { lookaheadDepth, mcSamples, rng }
        )
        if (baseCand) {
          hasViableShot = true
          const { nextScore, hasNext, ...rest } = baseCand
          if (isBetterShotCandidate(rest, best)) {
            best = { ...rest, cueBallPosition: req.state.ballInHand ? cuePos : undefined }
          }
          // Only explore additional power/spin if next position is poor and there is a next target
          if (!hasNext || nextScore >= 0.55) {
            continue
          }
        }

        const spins = buildSpinCandidates(cuePos, target, pocket, req)
        for (const power of powers) {
          for (const spin of spins.concat(defaultSpins)) {
            if (power === powers[0] && spin === spins[0]) continue
            if (Date.now() > deadline) {
              return best && best.quality >= MIN_COMPETITIVE_QUALITY ? best : fallbackAimAtTarget(req) || safetyShot(req)
            }
            const cand = evaluate(
              req,
              cuePos,
              target,
              pocket,
              power,
              spin,
              balls,
              strict,
              { lookaheadDepth, mcSamples, rng }
            )
            if (cand) {
              hasViableShot = true
              const { nextScore, hasNext, ...rest } = cand
              if (isBetterShotCandidate(rest, best)) {
                best = { ...rest, cueBallPosition: req.state.ballInHand ? cuePos : undefined }
              }
            }
          }
        }
      }
    }
    if (best) break
  }

  if (best) {
    const neutralSpin =
      Math.abs(best.spin?.top || 0) < 1e-6 &&
      Math.abs(best.spin?.side || 0) < 1e-6 &&
      Math.abs(best.spin?.back || 0) < 1e-6
    if (neutralSpin && best.power > 0.5 * POWER_SCALE && best.quality >= 0.45) {
      best.power = 0.5 * POWER_SCALE
    }
    const suggestion = findSuggestedTarget(req, best.targetBallId)
    if (suggestion) {
      best.suggestedTargetBallId = suggestion.suggestedTargetBallId
      best.suggestedAimPoint = suggestion.suggestedAimPoint
    }
    if (best.quality >= MIN_COMPETITIVE_QUALITY) return best
    if (hasViableShot) return best
  }
  if (!hasViableShot) return safetyShot(req)
  fallback = fallbackAimAtTarget(req)
  if (fallback) return fallback
  return safetyShot(req)
}

export default planShot
