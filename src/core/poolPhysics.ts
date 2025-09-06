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
}

// Jaw physics has been disabled; collisions with pocket openings are ignored.
// These helpers now act as no-ops or unconditional passes so that balls do not
// bounce off invisible pocket jaws.
export function resolveJawCollision(_ball: Ball, _normal: Vec2, _params: JawParams, _time: number) {
  // no-op: allow the ball to continue on its path
}

export function centerPathIntersectsFunnel(_ball: Ball, _pocket: Pocket, _params: JawParams): boolean {
  // without jaws, any trajectory is considered valid for pocket entry
  return true
}

export function willEnterPocket(_vPrime: Vec2, _pocket: Pocket, _params: JawParams): boolean {
  // without jaws, balls always enter the pocket once inside the mouth
  return true
}

export function sinkIntoPocket(ball: Ball) {
  ball.velocity = { x: 0, y: 0 }
  ball.omega = 0
}

