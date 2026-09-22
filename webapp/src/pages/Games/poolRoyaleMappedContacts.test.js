import assert from 'node:assert/strict'
import test from 'node:test'
import { separatePoolBalls, findClearPoolBallPosition } from './poolRoyaleBallSeparation.js'
import { createShowoodTableGeometry, closestPointOnPoolCushion, projectPoolBallFromCushions } from './shared/poolRoyaleShowoodGeometry.js'

const radius = 0.028575
const geometry = createShowoodTableGeometry({ playWidth: 1.27, playLength: 2.54, ballRadius: radius })
const makeBall = (id, x, y) => ({ id, active: true, pos: { x, y }, vel: { x: 0, y: 0 } })
const projectBall = (ball, size) => projectPoolBallFromCushions(ball.pos, size, geometry.segments)
const assertNoSolidOverlap = (balls) => {
  for (const ball of balls) {
    for (const segment of geometry.segments) {
      const nearest = closestPointOnPoolCushion(ball.pos, segment)
      assert.ok(Math.hypot(ball.pos.x - nearest.x, ball.pos.y - nearest.y) >= radius - 1e-8,
        `Ball ${ball.id} intersects mapped cushion ${segment.polygonId}`)
    }
  }
  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      assert.ok(Math.hypot(balls[i].pos.x - balls[j].pos.x, balls[i].pos.y - balls[j].pos.y) >= radius * 2 - 1e-8)
    }
  }
}

test('frozen six-ball cluster clears the actual Showood nose without pushing balls through it', () => {
  const balls = Array.from({ length: 6 }, (_, i) => makeBall(i + 1, 1.27 / 2 - radius - i * radius * 1.92, 0.7))
  separatePoolBalls(balls, radius * 2, { projectBall })
  assertNoSolidOverlap(balls)
  assert.ok(balls.every(ball => ball.pos.x <= 1.27 / 2 - radius + 1e-8))
  assert.ok(balls.every(ball => ball.vel.x === 0 && ball.vel.y === 0))
})

test('mapped jaw contacts and neighbouring balls converge together', () => {
  const jaw = geometry.segments.find(segment => segment.type === 'jaw' && segment.start.x > 0 && segment.start.y > 0.8 && segment.normal.x < -0.95 && segment.normal.y > 0)
  assert.ok(jaw)
  const middle = { x: (jaw.start.x + jaw.end.x) / 2, y: (jaw.start.y + jaw.end.y) / 2 }
  const balls = Array.from({ length: 3 }, (_, i) => makeBall(i + 1,
    middle.x + jaw.normal.x * radius * (0.9 + i * 1.94),
    middle.y + jaw.normal.y * radius * (0.9 + i * 1.94)))
  separatePoolBalls(balls, radius * 2, { projectBall })
  assertNoSolidOverlap(balls)
})

test('position correction leaves the open middle-pocket throat open', () => {
  for (const pocket of geometry.pockets.filter(pocket => pocket.type === 'side')) {
    const ball = makeBall('cue', pocket.x, pocket.y)
    const position = { ...ball.pos }
    separatePoolBalls([ball], radius * 2, { projectBall })
    assert.deepEqual(ball.pos, position)
  }
})

test('clear placement can reject the measured Showood jaws before committing a cue position', () => {
  const acceptPosition = point => {
    const projected = { ...point }
    return !projectPoolBallFromCushions(projected, radius, geometry.segments)
  }
  const point = findClearPoolBallPosition([], { x: 0.62, y: 1.24 }, {
    radius, bounds: { minX: -geometry.railLimits.x, maxX: geometry.railLimits.x, minY: -geometry.railLimits.y, maxY: geometry.railLimits.y }, acceptPosition
  })
  assert.ok(point)
  assert.ok(acceptPosition(point))
})
