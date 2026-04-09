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

function pocketMouthCenter (pocket, radius, width, height) {
  if (
    pocket?.mouth &&
    Number.isFinite(pocket.mouth.x) &&
    Number.isFinite(pocket.mouth.y)
  ) {
    return { x: pocket.mouth.x, y: pocket.mouth.y }
  }
  if (
    pocket?.mouthCenter &&
    Number.isFinite(pocket.mouthCenter.x) &&
    Number.isFinite(pocket.mouthCenter.y)
  ) {
    return { x: pocket.mouthCenter.x, y: pocket.mouthCenter.y }
  }
  const edgeTol = Math.max(radius * 3.5, Math.min(width, height) * 0.06)
  const nearLeft = pocket.x <= edgeTol
  const nearRight = pocket.x >= width - edgeTol
  const nearTop = pocket.y <= edgeTol
  const nearBottom = pocket.y >= height - edgeTol

  // Corner pockets: mouth center is between the two angled jaw cuts.
  if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
    const jawInset = radius * 1.8
    return {
      x: nearLeft ? jawInset * 0.5 : width - jawInset * 0.5,
      y: nearTop ? jawInset * 0.5 : height - jawInset * 0.5
    }
  }

  // Side pockets: mouth center is between the two jaw points on that rail.
  if (nearLeft || nearRight) {
    const jawSpan = radius * 2.5
    return {
      x: nearLeft ? radius * 0.55 : width - radius * 0.55,
      y: Math.max(jawSpan, Math.min(height - jawSpan, pocket.y))
    }
  }

  return {
    x: Math.max(radius * 0.55, Math.min(width - radius * 0.55, pocket.x)),
    y: nearTop ? radius * 0.55 : nearBottom ? height - radius * 0.55 : pocket.y
  }
}

function pocketMouthProfile (pocket, radius, width, height) {
  if (
    pocket?.jawA &&
    pocket?.jawB &&
    Number.isFinite(pocket.jawA.x) &&
    Number.isFinite(pocket.jawA.y) &&
    Number.isFinite(pocket.jawB.x) &&
    Number.isFinite(pocket.jawB.y)
  ) {
    const mouth = pocketMouthCenter(pocket, radius, width, height)
    const lateralRaw = { x: pocket.jawB.x - pocket.jawA.x, y: pocket.jawB.y - pocket.jawA.y }
    const lateralLen = Math.hypot(lateralRaw.x, lateralRaw.y) || 1
    return {
      mouth,
      jawA: { x: pocket.jawA.x, y: pocket.jawA.y },
      jawB: { x: pocket.jawB.x, y: pocket.jawB.y },
      lateral: { x: lateralRaw.x / lateralLen, y: lateralRaw.y / lateralLen },
      halfSpan: lateralLen * 0.5
    }
  }
  const edgeTol = Math.max(radius * 3.5, Math.min(width, height) * 0.06)
  const nearLeft = pocket.x <= edgeTol
  const nearRight = pocket.x >= width - edgeTol
  const nearTop = pocket.y <= edgeTol
  const nearBottom = pocket.y >= height - edgeTol
  const mouth = pocketMouthCenter(pocket, radius, width, height)

  // Approximate jaw-tip locations at the cushion cuts for each pocket type.
  let jawA
  let jawB
  if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
    const jawInset = radius * 1.8
    jawA = {
      x: nearLeft ? jawInset : width - jawInset,
      y: mouth.y
    }
    jawB = {
      x: mouth.x,
      y: nearTop ? jawInset : height - jawInset
    }
  } else if (nearLeft || nearRight) {
    const x = nearLeft ? radius * 0.55 : width - radius * 0.55
    const jawSpan = radius * 2.5
    jawA = { x, y: Math.max(radius, mouth.y - jawSpan) }
    jawB = { x, y: Math.min(height - radius, mouth.y + jawSpan) }
  } else {
    const y = nearTop ? radius * 0.55 : nearBottom ? height - radius * 0.55 : mouth.y
    const jawSpan = radius * 2.5
    jawA = { x: Math.max(radius, mouth.x - jawSpan), y }
    jawB = { x: Math.min(width - radius, mouth.x + jawSpan), y }
  }

  const lateral = { x: jawB.x - jawA.x, y: jawB.y - jawA.y }
  const lateralLen = Math.hypot(lateral.x, lateral.y) || 1
  return {
    mouth,
    jawA,
    jawB,
    lateral: { x: lateral.x / lateralLen, y: lateral.y / lateralLen },
    halfSpan: lateralLen * 0.5
  }
}

function pocketEntry (pocket, radius, width, height, target, options = null) {
  const profile = pocketMouthProfile(pocket, radius, width, height)
  const mouth = profile.mouth
  const normal = pocketNormal(mouth, width, height)
  const safeHalfGap = Math.max(0, profile.halfSpan - radius * 1.05)
  let lateralOffset = 0
  let dir = normal

  if (target) {
    const targetDir = { x: mouth.x - target.x, y: mouth.y - target.y }
    const len = Math.hypot(targetDir.x, targetDir.y) || 1
    const unitTargetDir = { x: targetDir.x / len, y: targetDir.y / len }
    const cue = options?.cue || null
    const incomingDir = cue
      ? { x: target.x - cue.x, y: target.y - cue.y }
      : unitTargetDir
    const incomingLen = Math.hypot(incomingDir.x, incomingDir.y) || 1
    const unitIncomingDir = { x: incomingDir.x / incomingLen, y: incomingDir.y / incomingLen }
    dir = {
      x: unitTargetDir.x * 0.72 + normal.x * 0.28,
      y: unitTargetDir.y * 0.72 + normal.y * 0.28
    }
    const blendedLen = Math.hypot(dir.x, dir.y) || 1
    dir = { x: dir.x / blendedLen, y: dir.y / blendedLen }

    // Use cushion jaw cuts as a guide:
    // choose the far jaw side (opposite the first jaw) on cut shots.
    const pocketCutness = 1 - Math.max(0, unitTargetDir.x * normal.x + unitTargetDir.y * normal.y)
    const collisionCutness = 1 - Math.max(0, unitIncomingDir.x * unitTargetDir.x + unitIncomingDir.y * unitTargetDir.y)
    const cutness = Math.max(pocketCutness, collisionCutness * 0.92)
    if (cutness > 0.05 && safeHalfGap > 0) {
      const approachAlongMouth = unitIncomingDir.x * profile.lateral.x + unitIncomingDir.y * profile.lateral.y
      const farSide = approachAlongMouth >= 0 ? 1 : -1
      const desired = safeHalfGap * Math.min(cutness * 0.78, 0.72)
      lateralOffset = farSide * desired

      const balls = Array.isArray(options?.balls) ? options.balls : null
      if (balls?.length) {
        const ignoreBallIds = new Set(options?.ignoreBallIds || [])
        let nearCrowd = 0
        let farCrowd = 0
        for (const b of balls) {
          if (!b || b.pocketed || ignoreBallIds.has(b.id)) continue
          const relX = b.x - mouth.x
          const relY = b.y - mouth.y
          const lateral = relX * profile.lateral.x + relY * profile.lateral.y
          const depth = relX * normal.x + relY * normal.y
          if (Math.abs(lateral) > profile.halfSpan + radius * 1.5) continue
          if (depth < -radius * 1.2 || depth > radius * 3.25) continue
          const proximity = 1 / (0.35 + Math.abs(depth) / radius + Math.abs(Math.abs(lateral) - safeHalfGap) / Math.max(radius * 0.75, 1))
          if (Math.sign(lateral || 1) === farSide) farCrowd += proximity
          else nearCrowd += proximity
        }

        const crowdDelta = nearCrowd - farCrowd
        if (crowdDelta > 0.18) {
          const boost = Math.min(0.22, crowdDelta * 0.11)
          lateralOffset = farSide * Math.min(safeHalfGap * 0.92, Math.abs(lateralOffset) + safeHalfGap * boost)
        } else if (crowdDelta < -0.12) {
          // If far side is actually tighter, pull back toward the center lane.
          lateralOffset *= 0.6
        }
      }
    }
  }

  const offset = Math.max(radius * 0.34, Math.min(radius * 0.48, radius * 0.38 + safeHalfGap * 0.08))
  return {
    x: mouth.x + profile.lateral.x * lateralOffset - dir.x * offset,
    y: mouth.y + profile.lateral.y * lateralOffset - dir.y * offset
  }
}

function pocketEntryOptionsForTarget (req, target) {
  if (!req?.state || !target) return null
  const cueBallId = resolveCueBallId(req.state)
  const cue = req.state.balls.find(b => b.id === cueBallId)
  return {
    cue,
    balls: req.state.balls,
    ignoreBallIds: [cueBallId, target.id]
  }
}

function targetPocketLaneBlocked (target, pocket, entry, req, balls) {
  if (!target || !pocket || !entry || !req?.state) return true
  const r = req.state.ballRadius
  const cueBallId = resolveCueBallId(req.state)
  const tableBalls = balls || req.state.balls || []
  const ignore = [cueBallId, target.id]

  // Object ball path must be clear up to the pocket entry and through the mouth center.
  const mouth = pocketMouthCenter(pocket, r, req.state.width, req.state.height)
  if (pathBlocked(target, entry, tableBalls, ignore, r, 1.02)) return true
  if (pathBlocked(entry, mouth, tableBalls, ignore, r, 0.96)) return true

  // Also verify a clear corridor around the pocket lane (not just line-center).
  const laneLen = Math.max(dist(target, entry), 1e-6)
  const laneDir = { x: (entry.x - target.x) / laneLen, y: (entry.y - target.y) / laneLen }
  const laneHalfWidth = r * 1.06
  for (const b of tableBalls) {
    if (!b || b.pocketed || ignore.includes(b.id)) continue
    const relX = b.x - target.x
    const relY = b.y - target.y
    const along = relX * laneDir.x + relY * laneDir.y
    if (along <= r * 0.2 || along >= laneLen + r * 1.15) continue
    const lateral = Math.abs(relX * laneDir.y - relY * laneDir.x)
    if (lateral < laneHalfWidth * 2) return true
  }

  for (const b of tableBalls) {
    if (!b || b.pocketed || ignore.includes(b.id)) continue
    if (dist(b, entry) < r * 1.1 || dist(b, mouth) < r * 1.02) return true
  }

  return false
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
  const profile = pocketMouthProfile(pocket, r, req.state.width, req.state.height)
  const minJawClearance = Math.max(0, profile.halfSpan - r * 1.05)
  if (minJawClearance <= 0) return 0
  const entry = pocketEntry(
    pocket,
    r,
    req.state.width,
    req.state.height,
    target,
    pocketEntryOptionsForTarget(req, target)
  )
  const dx = entry.x - profile.mouth.x
  const dy = entry.y - profile.mouth.y
  const entryLateral = Math.abs(dx * profile.lateral.x + dy * profile.lateral.y)
  const jawClearanceScore = Math.max(0, 1 - entryLateral / (minJawClearance + 1e-6))
  const laneLen = Math.max(dist(target, entry), r * 2)
  const laneDir = { x: (entry.x - target.x) / laneLen, y: (entry.y - target.y) / laneLen }
  let minEdge = Infinity
  for (const b of req.state.balls || []) {
    if (!b || b.pocketed || b.id === target.id) continue
    const relX = b.x - target.x
    const relY = b.y - target.y
    const along = relX * laneDir.x + relY * laneDir.y
    if (along <= 0 || along >= laneLen + r * 1.8) continue
    const lateral = Math.abs(relX * laneDir.y - relY * laneDir.x)
    const edgeGap = lateral - r * 2
    if (edgeGap < minEdge) minEdge = edgeGap
  }
  const clearance = Number.isFinite(minEdge)
    ? Math.max(0, Math.min((minEdge + r * 0.9) / (r * 2.2), 1))
    : 1
  const alignment = pocketAlignment(pocket, target, req.state.width, req.state.height)
  const straightness = Math.max(0, Math.min((alignment - 0.2) / 0.8, 1))
  return Math.min(1, clearance * 0.5 + straightness * 0.2 + jawClearanceScore * 0.3)
}

function ghostPointForTargetPocket (target, pocket, req) {
  const r = req.state.ballRadius
  const entry = pocketEntry(
    pocket,
    r,
    req.state.width,
    req.state.height,
    target,
    pocketEntryOptionsForTarget(req, target)
  )
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


function resolveLegalTargetIds (req) {
  const state = req?.state || {}
  const balls = Array.isArray(state.balls) ? state.balls : []
  const cueBallId = resolveCueBallId(state)
  const legalIds = new Set(
    (Array.isArray(state.legalBallIds) ? state.legalBallIds : [])
      .map(value => Number(value))
      .filter(Number.isFinite)
  )

  const hints = []
  if (Array.isArray(state.legalTargetSuggestions)) hints.push(...state.legalTargetSuggestions)
  if (state.legalTargetSuggestion) hints.push(state.legalTargetSuggestion)

  for (const hint of hints) {
    if (!hint) continue
    const idCandidate = [
      hint.id,
      hint.ballId,
      hint.targetBallId,
      hint.number,
      hint.markerNumber,
      hint.ball?.id,
      hint.ball?.ballId,
      hint.ball?.number,
      hint.ball?.markerNumber
    ]
      .map(value => Number(value))
      .find(Number.isFinite)

    if (Number.isFinite(idCandidate)) {
      legalIds.add(idCandidate)
      continue
    }

    const targetPos = hint.ball || hint.target || hint.targetBall || hint.position || hint
    if (!targetPos || !Number.isFinite(targetPos.x) || !Number.isFinite(targetPos.y)) continue
    const radius = Number.isFinite(state.ballRadius) ? state.ballRadius : 10
    let nearest = null
    let nearestDistance = Infinity
    for (const ball of balls) {
      if (!ball || ball.pocketed || ball.id === cueBallId) continue
      const d = dist(ball, targetPos)
      if (d < nearestDistance) {
        nearestDistance = d
        nearest = ball
      }
    }
    if (nearest && nearestDistance <= radius * 3.5) {
      legalIds.add(nearest.id)
    }
  }

  return Array.from(legalIds)
}

function chooseTargets (req) {
  const cueBallId = resolveCueBallId(req.state)
  const balls = req.state.balls.filter(b => !b.pocketed && b.id !== cueBallId)
  const legalBallIds = resolveLegalTargetIds(req)
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
  const legalBallIds = resolveLegalTargetIds(req)
    .filter(id => id !== targetId)
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
      const entry = pocketEntry(
        pocket,
        r,
        req.state.width,
        req.state.height,
        target,
        pocketEntryOptionsForTarget(req, target)
      )
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
      if (pathBlocked(cue, ghost, req.state.balls, [cueBallId, target.id], r, 1.1)) {
        continue
      }
      if (targetPocketLaneBlocked(target, pocket, entry, req, req.state.balls)) {
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
      const approachStraightness = 1 - Math.min(cut / (Math.PI / 2), 1)
      const cueToTarget = cue ? dist(cue, target) : 0
      const distanceScore = cue ? Math.max(0, 1 - cueToTarget / (r * 60)) : 0
      const pocketTravelPenalty = Math.min(entryDistance / (r * 28), 1)
      const rank =
        pocketView * 0.52 +
        approachStraightness * 0.31 +
        distanceScore * 0.08 +
        entranceOpenness * 0.17 -
        pocketTravelPenalty * 0.08

      // require fairly central hit and open pocket view
      if (cut <= maxCut && pocketView >= minView) {
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
function monteCarloPotChance (req, cue, target, pocket, entry, ghost, balls, samples = 20, rng = Math.random) {
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
    if (targetPocketLaneBlocked(target, pocket, entry, req, balls)) continue
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
      const entry = pocketEntry(
        pocket,
        req.state.ballRadius,
        req.state.width,
        req.state.height,
        target,
        pocketEntryOptionsForTarget(req, target)
      )
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

  const entry = pocketEntry(
    pocket,
    req.state.ballRadius,
    req.state.width,
    req.state.height,
    target,
    pocketEntryOptionsForTarget(req, target)
  )
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

  return [adaptive, ...base]
}

function evaluate (req, cue, target, pocket, power, spin, ballsOverride, strict = false, options = {}) {
  const r = req.state.ballRadius
  const cueBallId = resolveCueBallId(req.state)
  const rng = options.rng ?? Math.random
  const balls = ballsOverride || req.state.balls
  const entry = pocketEntry(
    pocket,
    r,
    req.state.width,
    req.state.height,
    target,
    pocketEntryOptionsForTarget(req, target)
  )
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
  if (pathBlocked(cue, ghost, balls, [cueBallId, target.id], r, 1.1)) {
    return null
  }
  if (targetPocketLaneBlocked(target, pocket, entry, req, balls)) {
    return null
  }
  const maxD = Math.hypot(req.state.width, req.state.height)
  const mcSamples = Number.isFinite(options.mcSamples)
    ? Math.max(24, Math.round(options.mcSamples))
    : 20
  const potChance = monteCarloPotChance(req, cue, target, pocket, entry, ghost, balls, mcSamples, rng)
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
  const cueToTarget = dist(cue, target)
  const shotLengthFactor = Math.min(cueToTarget / (r * 40), 2)
  const cutSeverity = Math.min(cutAngle / (Math.PI / 2), 1)
  const pocketTightness = 1 - pocketOpen
  const difficultyPenalty = 0.25 * (0.5 * cutSeverity + 0.3 * shotLengthFactor + 0.2 * pocketTightness)
  const spinPenalty =
    Math.abs(spin.side || 0) * 0.06 +
    Math.max(0, spin.back || 0) * 0.12 +
    Math.max(0, spin.top || 0) * 0.04
  const powerControlPenalty = Math.max(0, power - (0.5 * POWER_SCALE)) * 0.35
  const clearanceScore = Math.max(0, Math.min((laneClearance - 0.5) / 0.7, 1))
  if (strict && (centerAlign < 0.5 || pocketOpen < 0.3)) {
    return null
  }
  const lookaheadDepth = Number.isFinite(options.lookaheadDepth)
    ? Math.max(0, options.lookaheadDepth)
    : LOOKAHEAD_DEPTH
  const runoutPotential = options.skipLookahead
    ? 0
    : estimateRunoutPotential(req, cueAfter, target.id, balls, lookaheadDepth, rng)
  const quality = Math.max(
    0,
    Math.min(
      1,
      0.46 * potChance +
        0.15 * pocketOpen +
        0.13 * centerAlign +
        0.06 * nextScore +
        0.03 * nearHole +
        0.14 * runoutPotential +
        0.11 * clearanceScore -
        0.21 * risk -
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
    rationale: `target=${target.id} pocket=(${pocket.x.toFixed(0)},${pocket.y.toFixed(0)}) angle=${angle.toFixed(2)} power=${power.toFixed(2)} spin=${spin.top.toFixed(2)},${spin.side.toFixed(2)},${spin.back.toFixed(2)} pc=${potChance.toFixed(2)} ca=${centerAlign.toFixed(2)} nh=${nearHole.toFixed(2)} np=${nextScore.toFixed(2)} r=${risk.toFixed(2)}`,
    nextScore,
    hasNext
  }
}

function safetyShot (req) {
  const cueBallId = resolveCueBallId(req.state)
  const cue = req.state.balls.find(b => b.id === cueBallId)
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
    rationale: 'safety'
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
    const entry = pocketEntry(
      bestPocket,
      req.state.ballRadius,
      req.state.width,
      req.state.height,
      target,
      pocketEntryOptionsForTarget(req, target)
    )
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
      const entry = pocketEntry(
        pocket,
        r,
        req.state.width,
        req.state.height,
        target,
        pocketEntryOptionsForTarget(req, target)
      )
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
              return best && best.quality >= 0.1 ? best : fallbackAimAtTarget(req) || safetyShot(req)
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
    if (best.quality >= 0.1) return best
    if (hasViableShot) return best
  }
  if (!hasViableShot) return safetyShot(req)
  fallback = fallbackAimAtTarget(req)
  if (fallback) return fallback
  return safetyShot(req)
}

export default planShot
