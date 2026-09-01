import test from 'node:test'
import assert from 'node:assert/strict'
import { AlbanianBilliards } from '../lib/albanianBilliards.js'

test('Albanian Billiards scores face values and reaches 61 immediately', () => {
  const game = new AlbanianBilliards()
  game.state.breakInProgress = false
  game.state.scores.A = 59
  game.state.ballsOnTable = new Set([2, 15])
  const result = game.shotTaken({ contactOrder: [2], potted: [2] })
  assert.equal(result.pointsScored, 2)
  assert.equal(result.scores.A, 61)
  assert.equal(result.winner, 'A')
  assert.equal(result.frameOver, true)
})

test('Albanian Billiards requires the lowest ball first', () => {
  const game = new AlbanianBilliards()
  const result = game.shotTaken({ contactOrder: [2], potted: [] })
  assert.equal(result.foul, true)
  assert.match(result.reason, /needed 1/)
  assert.equal(result.ballInHandNext, true)
  assert.equal(result.nextPlayer, 'B')
})

test('a legal dry shot needs a cushion and passes the turn', () => {
  const game = new AlbanianBilliards()
  const result = game.shotTaken({
    contactOrder: [1], potted: [], railContactsAfterFirstHit: 1
  })
  assert.equal(result.foul, false)
  assert.equal(result.nextPlayer, 'B')
})

test('a foul does not award points but object balls stay down', () => {
  const game = new AlbanianBilliards()
  const result = game.shotTaken({ contactOrder: [1], potted: [1, 0] })
  assert.equal(result.pointsScored, 0)
  assert.equal(result.scores.A, 0)
  assert.equal(game.state.ballsOnTable.has(1), false)
})
