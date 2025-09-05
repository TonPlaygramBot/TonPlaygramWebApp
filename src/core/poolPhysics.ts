export interface Vec2 { x: number; y: number }

export function add(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y } }
export function sub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y } }
export function scale(v: Vec2, s: number): Vec2 { return { x: v.x * s, y: v.y * s } }
export function dot(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y }
export function length(v: Vec2): number { return Math.hypot(v.x, v.y) }
export function normalize(v: Vec2): Vec2 {
  const len = length(v)
  return len > 0 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 }
}
export function crossZ(a: Vec2, b: Vec2): number { return a.x * b.y - a.y * b.x }

export interface Ball {
  position: Vec2
  velocity: Vec2
  omega: number
  rattleCount: number
  lastJawHitTime: number
}

export interface Pocket {
  center: Vec2
  uPocket: Vec2 // unit vector into pocket
  mouthWidth: number
  funnelDepth: number
}

export interface JawParams {
  ballRadius: number
  eJaw: number
  muJaw: number
  dragJaw: number
  captureSpeedMin: number
  reboundThreshold: number
  lipOutAngle: number
  lipOutSpeed: number
  rattleTimeWindow: number
}

export function reflectWithFrictionAndSpin(v: Vec2, n: Vec2, eJaw: number, muJaw: number, dragJaw: number, omega: number) {
  const nN = normalize(n)
  const vn = dot(v, nN)
  const vt = sub(v, scale(nN, vn))
  let vPrime = sub(scale(vt, 1 - muJaw), scale(nN, eJaw * vn))
  vPrime = scale(vPrime, 1 - dragJaw)
  const omegaPrime = omega + muJaw * vn
  return { v: vPrime, omega: omegaPrime }
}

export function resolveJawCollision(ball: Ball, normal: Vec2, params: JawParams, time: number) {
  let e = params.eJaw
  if (time - ball.lastJawHitTime <= params.rattleTimeWindow) {
    ball.rattleCount += 1
    e *= Math.pow(0.95, ball.rattleCount)
  } else {
    ball.rattleCount = 0
  }
  const res = reflectWithFrictionAndSpin(ball.velocity, normal, e, params.muJaw, params.dragJaw, ball.omega)
  ball.velocity = res.v
  ball.omega = res.omega
  ball.lastJawHitTime = time
}

export function centerPathIntersectsFunnel(ball: Ball, pocket: Pocket, params: JawParams): boolean {
  const dir = normalize(ball.velocity)
  if (length(dir) === 0) return false
  const toCenter = sub(pocket.center, ball.position)
  const dist = Math.abs(crossZ(toCenter, dir))
  return dist < pocket.mouthWidth / 2 - params.ballRadius
}

export function willEnterPocket(vPrime: Vec2, pocket: Pocket, params: JawParams): boolean {
  const speed = length(vPrime)
  const toPocket = dot(vPrime, pocket.uPocket)
  const cosAng = toPocket / (speed || 1)
  const ang = Math.acos(Math.min(Math.max(cosAng, -1), 1)) * 180 / Math.PI
  if (ang > params.lipOutAngle && speed > params.lipOutSpeed) return false
  if (toPocket > params.captureSpeedMin) return true
  if (speed < params.reboundThreshold) return true
  return false
}

export function sinkIntoPocket(ball: Ball) {
  ball.velocity = { x: 0, y: 0 }
  ball.omega = 0
}

