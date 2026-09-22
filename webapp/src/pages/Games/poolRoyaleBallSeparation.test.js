import assert from 'node:assert/strict'
import test from 'node:test'

import { separatePoolBalls } from './poolRoyaleBallSeparation.js'

const distance = (a, b) => Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y)

test('separates an overlapping pair to the physical diameter', () => {
  const balls = [
    { id: 'cue', active: true, pos: { x: 0, y: 0 } },
    { id: 1, active: true, pos: { x: 1.4, y: 0 } }
  ]

  assert.equal(separatePoolBalls(balls, 2), true)
  assert.ok(distance(balls[0], balls[1]) >= 2 - 1e-9)
})

test('iteratively removes penetration from a dense three-ball chain', () => {
  const balls = [
    { id: 1, active: true, pos: { x: 0, y: 0 } },
    { id: 2, active: true, pos: { x: 1.2, y: 0 } },
    { id: 3, active: true, pos: { x: 2.4, y: 0 } }
  ]

  separatePoolBalls(balls, 2, 24)

  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      assert.ok(distance(balls[i], balls[j]) >= 2 - 1e-6)
    }
  }
})

test('ignores pocketed balls and resolves coincident centres deterministically', () => {
  const balls = [
    { id: 'a', active: true, pos: { x: 3, y: 3 } },
    { id: 'b', active: true, pos: { x: 3, y: 3 } },
    { id: 'pocketed', active: false, pos: { x: 3, y: 3 } }
  ]

  separatePoolBalls(balls, 2)

  assert.ok(distance(balls[0], balls[1]) >= 2 - 1e-9)
  assert.deepEqual(balls[2].pos, { x: 3, y: 3 })
})

const assertNoOverlap = (balls, diameter = 2, tolerance = diameter * 2e-7) => {
  const active = balls.filter(ball => ball.active)
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const required = (active[i].radius ?? diameter / 2) + (active[j].radius ?? diameter / 2)
      assert.ok(distance(active[i], active[j]) >= required - tolerance,
        `Balls ${active[i].id}/${active[j].id} remain overlapped by ${required - distance(active[i], active[j])}`)
    }
  }
}

const cluster = (count, position) => Array.from({ length: count }, (_, index) => ({
  id: index + 1,
  active: true,
  pos: position(index),
  vel: { x: index * 0.11, y: -index * 0.09 },
  omega: { x: 0.02, y: 0.03, z: 0.04 },
  lastRailHitAt: 73,
  impacted: false
}))

test('clears all sixteen coincident balls deterministically without changing energy or contact state', () => {
  const balls = cluster(16, () => ({ x: 0, y: 0 }))
  const reversed = structuredClone(balls).reverse()
  const originalState = balls.map(({ pos, ...state }) => state)
  separatePoolBalls(balls, 2)
  separatePoolBalls(reversed, 2)
  assertNoOverlap(balls)
  assert.deepEqual(balls.map(({ pos, ...state }) => state), originalState)
  assert.deepEqual(balls, reversed.reverse())
})

test('resolves a compressed sixteen-ball line touching a rail without crossing that rail', () => {
  const balls = cluster(16, index => ({ x: index * 1.95, y: 0 }))
  separatePoolBalls(balls, 2, { bounds: { minX: 0, maxX: 50, minY: -10, maxY: 10 } })
  assertNoOverlap(balls)
  for (const ball of balls) assert.ok(ball.pos.x >= 0 && ball.pos.x <= 50)
})

test('alternates ball and custom cushion constraints instead of finishing inside the cushion', () => {
  const balls = cluster(6, index => ({ x: index * 1.6, y: 0 }))
  separatePoolBalls(balls, 2, {
    projectBall: (ball, radius) => { ball.pos.x = Math.max(radius, ball.pos.x) }
  })
  assertNoOverlap(balls)
  for (const ball of balls) assert.ok(ball.pos.x >= 1)
})

test('clears tight triangular racks at multiple real-world scales', () => {
  for (const radius of [0.028575, 1, 2.971]) {
    for (let run = 0; run < 12; run += 1) {
      const balls = []
      for (let row = 0; row < 5; row += 1) {
        for (let column = 0; column <= row; column += 1) {
          const id = balls.length + 1
          balls.push({ id, active: true, pos: {
            x: (column * 2 - row) * radius * 0.99 + Math.sin(id + run) * radius * 0.015,
            y: row * Math.sqrt(3) * radius * 0.99 + Math.cos(id + run) * radius * 0.015
          } })
        }
      }
      separatePoolBalls(balls, radius * 2)
      assertNoOverlap(balls, radius * 2)
    }
  }
})

test('uses physical radii and does not expand already separated or pocketed balls', () => {
  const balls = cluster(2, () => ({ x: 0, y: 0 }))
  balls[0].radius = 0.75
  balls[1].radius = 1.25
  balls.push({ id: 'pocketed', active: false, pos: { x: 0, y: 0 } })
  separatePoolBalls(balls, 10)
  assertNoOverlap(balls, 2)
  assert.ok(distance(balls[0], balls[1]) < 2.000001)
  const settled = structuredClone(balls)
  assert.equal(separatePoolBalls(balls, 10), false)
  assert.deepEqual(balls, settled)
})

test('ignores corrupt positions without contaminating valid balls', () => {
  const balls = cluster(2, index => ({ x: index, y: 0 }))
  balls.push({ id: 'bad', active: true, pos: { x: NaN, y: 0 } })
  separatePoolBalls(balls, 2, { iterations: Infinity })
  assertNoOverlap(balls.slice(0, 2))
  assert.ok(balls.slice(0, 2).every(ball => Number.isFinite(ball.pos.x) && Number.isFinite(ball.pos.y)))
})
