import test from 'node:test'
import assert from 'node:assert/strict'
import { AmericanBilliards } from '../lib/americanBilliards.js'

test('first contact must be lowest ball (including break shot)', () => {
  const game = new AmericanBilliards()
  const res = game.shotTaken({
    contactOrder: [3],
    potted: [],
    cueOffTable: false
  })

  assert.equal(res.foul, true)
  assert.equal(res.reason, 'wrong first contact')
  assert.equal(res.nextPlayer, 'B')
  assert.equal(res.ballInHandNext, true)
})


test('legal break pots score by ball value and keep shooter at table', () => {
  const game = new AmericanBilliards()
  const breakShot = game.shotTaken({
    contactOrder: [1],
    potted: [1, 2],
    cueOffTable: false
  })

  assert.equal(breakShot.foul, false)
  assert.equal(game.state.breakInProgress, false)
  assert.equal(game.state.scores.A, 3)
  assert.equal(breakShot.nextPlayer, 'A')
})

test('potting 9-ball legally scores points but does not auto-win before 61', () => {
  const game = new AmericanBilliards()
  game.state.breakInProgress = false
  game.state.ballsOnTable = new Set([1, 9])

  const res = game.shotTaken({
    contactOrder: [1],
    potted: [9],
    cueOffTable: false
  })

  assert.equal(res.foul, false)
  assert.equal(res.frameOver, false)
  assert.equal(res.winner, null)
  assert.equal(res.scores.A, 9)
})


test('break scratch is a foul and gives opponent ball in hand', () => {
  const game = new AmericanBilliards()
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [0],
    cueOffTable: false
  })

  assert.equal(res.foul, true)
  assert.equal(res.reason, 'scratch')
  assert.equal(res.nextPlayer, 'B')
  assert.equal(res.ballInHandNext, true)
  assert.equal(game.state.currentPlayer, 'B')
  assert.equal(game.state.breakInProgress, false)
})

test('scratch gives opponent ball in hand and keeps object balls down', () => {
  const game = new AmericanBilliards()
  game.state.breakInProgress = false
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [1, 0],
    cueOffTable: false
  })

  assert.equal(res.foul, true)
  assert.equal(res.reason, 'scratch')
  assert.equal(res.nextPlayer, 'B')
  assert.equal(res.ballInHandNext, true)
  assert.equal(game.state.ballsOnTable.has(1), false)
})

test('first post-break shot must contact the lowest remaining ball', () => {
  const game = new AmericanBilliards()
  game.shotTaken({
    contactOrder: [1],
    potted: [1],
    cueOffTable: false
  })
  const res = game.shotTaken({
    contactOrder: [3],
    potted: [],
    cueOffTable: false
  })

  assert.equal(res.foul, true)
  assert.equal(res.reason, 'wrong first contact')
})

test('reaching 61 points wins the frame immediately', () => {
  const game = new AmericanBilliards()
  game.state.breakInProgress = false
  game.state.scores.A = 59
  game.state.ballsOnTable = new Set([2, 15])

  const res = game.shotTaken({
    contactOrder: [2],
    potted: [2],
    cueOffTable: false
  })

  assert.equal(res.frameOver, true)
  assert.equal(res.winner, 'A')
  assert.equal(res.scores.A, 61)
})

test('on foul, potted 9 is spotted back up', () => {
  const game = new AmericanBilliards()
  game.state.breakInProgress = false
  game.state.ballsOnTable = new Set([1, 9])

  const res = game.shotTaken({
    contactOrder: [1],
    potted: [9, 0],
    cueOffTable: false
  })

  assert.equal(res.foul, true)
  assert.equal(res.reason, 'scratch')
  assert.equal(game.state.ballsOnTable.has(9), true)
})
