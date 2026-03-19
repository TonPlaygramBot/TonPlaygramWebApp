import test from 'node:test'
import assert from 'node:assert/strict'
import { AmericanBilliards } from '../lib/americanBilliards.js'

test('open table: first contact cannot be the 8-ball', () => {
  const game = new AmericanBilliards()
  game.state.breakInProgress = false
  const res = game.shotTaken({
    contactOrder: [2],
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

test('if all balls are gone before 61, higher score wins', () => {
  const game = new AmericanBilliards()
  game.state.breakInProgress = false
  game.state.currentPlayer = 'B'
  game.state.scores = { A: 40, B: 50 }
  game.state.ballsOnTable = new Set([15])

  const res = game.shotTaken({
    contactOrder: [15],
    potted: [15],
    cueOffTable: false
  })

  assert.equal(res.foul, false)
  assert.equal(res.frameOver, true)
  assert.equal(res.winner, 'B')
})
