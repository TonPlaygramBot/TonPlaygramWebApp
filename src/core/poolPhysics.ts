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
}

export interface Jaw {
  center: Vec2
  radius: number
  startAngle: number
  endAngle: number
}

export interface Pocket {
  center: Vec2
  uPocket: Vec2 // unit vector into pocket
  mouthWidth: number
  funnelDepth: number
  jaws: Jaw[]
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

export function closestPointOnArc(p: Vec2, jaw: Jaw): Vec2 {
  const rel = sub(p, jaw.center)
  const angle = Math.atan2(rel.y, rel.x)
  const clamped = Math.min(Math.max(angle, jaw.startAngle), jaw.endAngle)
  return {
    x: jaw.center.x + Math.cos(clamped) * jaw.radius,
    y: jaw.center.y + Math.sin(clamped) * jaw.radius,
  }
}

export function normalAt(jaw: Jaw, p: Vec2): Vec2 {
  return normalize(sub(p, jaw.center))
}

export function resolveJawCollision(ball: Ball, jaw: Jaw, params: JawParams, _time: number): boolean {
  const pClosest = closestPointOnArc(ball.position, jaw)
  const dist = length(sub(ball.position, pClosest))
  if (dist <= params.ballRadius) {
    const n = normalAt(jaw, pClosest)
    const res = reflectWithFrictionAndSpin(ball.velocity, n, params.eJaw, params.muJaw, params.dragJaw, ball.omega)
    ball.velocity = res.v
    ball.omega = res.omega
    return true
  }
  return false
}

export function centerPathIntersectsFunnel(ball: Ball, pocket: Pocket, params: JawParams, tolerance = 0.0001): boolean {
  const dir = normalize(ball.velocity)
  if (length(dir) === 0) return false
  const toCenter = sub(pocket.center, ball.position)
  const dist = Math.abs(crossZ(toCenter, dir))
  return dist < pocket.mouthWidth / 2 - params.ballRadius + tolerance
}

export function willEnterPocket(vPrime: Vec2, pocket: Pocket, params: JawParams): boolean {
  const speed = length(vPrime)
  const toPocket = dot(vPrime, pocket.uPocket)
  const cos = toPocket / (speed || 1)
  const angle = Math.acos(Math.min(1, Math.max(-1, cos))) * (180 / Math.PI)
  if (angle > params.lipOutAngle && speed > params.lipOutSpeed) return false
  if (toPocket > params.captureSpeedMin) return true
  if (speed < params.reboundThreshold) return true
  return false
}

export function sinkIntoPocket(ball: Ball) {
  ball.velocity = { x: 0, y: 0 }
  ball.omega = 0
}

