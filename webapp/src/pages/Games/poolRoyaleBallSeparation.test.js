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
