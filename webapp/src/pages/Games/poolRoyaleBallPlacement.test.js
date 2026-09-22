import assert from 'node:assert/strict'
import test from 'node:test'
import { findClearPoolBallPosition } from './poolRoyaleBallSeparation.js'

const bounds = { minX: -10, maxX: 10, minY: -20, maxY: 20 }
const ball = (id, x, y, active = true) => ({ id, active, pos: { x, y } })
const clear = (point, obstacles, radius = 1) => obstacles.every(other =>
  !other.active || other.id === 'cue' || Math.hypot(point.x - other.pos.x, point.y - other.pos.y) >= radius + (other.radius ?? radius))

test('keeps a clear preferred point and ignores the cue ball itself and potted balls', () => {
  const balls = [ball('cue', 0, 0), ball(1, 0, 0, false)]
  assert.deepEqual(findClearPoolBallPosition(balls, { x: 0, y: 0 }, { radius: 1, bounds }), { x: 0, y: 0 })
})

test('never accepts the old 1.7-radius overlap fallback', () => {
  const balls = [ball(1, 0, 0)]
  const point = findClearPoolBallPosition(balls, { x: 1.7, y: 0 }, { radius: 1, bounds, clearanceMultiplier: 1.7 })
  assert.ok(point)
  assert.ok(clear(point, balls))
  assert.notDeepEqual(point, { x: 1.7, y: 0 })
})

test('searches beyond a blocked local spawn area while respecting the baulk boundary', () => {
  const balls = []
  for (let x = -4; x <= 4; x += 2) {
    for (let y = -4; y <= 0; y += 2) balls.push(ball(balls.length + 1, x, y))
  }
  const restricted = { ...bounds, maxY: 0 }
  const point = findClearPoolBallPosition(balls, { x: 0, y: 0 }, { radius: 1, bounds: restricted, maxRadius: 0.2 })
  assert.ok(point)
  assert.ok(point.y <= 0 && point.y >= restricted.minY)
  assert.ok(clear(point, balls))
  assert.deepEqual(point, findClearPoolBallPosition(balls, { x: 0, y: 0 }, { radius: 1, bounds: restricted, maxRadius: 0.2 }))
})

test('returns null rather than an overlapping position when the allowed region is full', () => {
  const tinyBounds = { minX: -0.1, maxX: 0.1, minY: -0.1, maxY: 0.1 }
  assert.equal(findClearPoolBallPosition([ball(1, 0, 0)], { x: 0, y: 0 }, { radius: 1, bounds: tinyBounds }), null)
})

test('rejects forbidden cushion or pocket positions after clamping', () => {
  const acceptPosition = point => point.x > 3 && point.y < -3
  const point = findClearPoolBallPosition([], { x: 50, y: 50 }, { radius: 1, bounds, acceptPosition })
  assert.ok(point)
  assert.ok(acceptPosition(point))
  assert.ok(point.x <= bounds.maxX && point.y >= bounds.minY)
})

test('honours larger obstacle radii without moving any existing balls', () => {
  const obstacle = { ...ball(1, 0, 0), radius: 3 }
  const balls = [obstacle]
  const original = structuredClone(balls)
  const point = findClearPoolBallPosition(balls, { x: 3, y: 0 }, { radius: 1, bounds })
  assert.ok(point)
  assert.ok(clear(point, balls))
  assert.deepEqual(balls, original)
})

test('does not make a point when coordinates or bounds are invalid', () => {
  assert.equal(findClearPoolBallPosition([], { x: NaN, y: 0 }, { radius: 1, bounds }), null)
  assert.equal(findClearPoolBallPosition([], { x: 0, y: 0 }, { radius: 0, bounds }), null)
  assert.equal(findClearPoolBallPosition([], { x: 0, y: 0 }, { radius: 1, bounds: { ...bounds, minX: 11 } }), null)
})
