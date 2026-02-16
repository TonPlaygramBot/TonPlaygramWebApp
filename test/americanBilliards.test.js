import test from 'node:test'
import assert from 'node:assert/strict'
import { AmericanBilliards } from '../lib/americanBilliards.js'

test('open table: first contact cannot be the 8-ball', () => {
  const game = new AmericanBilliards()
  game.state.breakInProgress = false
  const res = game.shotTaken({
    contactOrder: [8],
    potted: [],
    cueOffTable: false
  })

  assert.equal(res.foul, true)
  assert.equal(res.reason, 'wrong first contact')
  assert.equal(res.nextPlayer, 'B')
  assert.equal(res.ballInHandNext, true)
})


test('legal break pot keeps table open until post-break shot', () => {
  const game = new AmericanBilliards()
  const breakShot = game.shotTaken({
    contactOrder: [2],
    potted: [2],
    cueOffTable: false
  })

  assert.equal(breakShot.foul, false)
  assert.equal(game.state.breakInProgress, false)
  assert.equal(game.state.assignments.A, null)
  assert.equal(game.state.assignments.B, null)

  const nextShot = game.shotTaken({
    contactOrder: [3],
    potted: [3],
    cueOffTable: false
  })

  assert.equal(nextShot.foul, false)
  assert.equal(game.state.assignments.A, 'SOLID')
  assert.equal(game.state.assignments.B, 'STRIPE')
})



test('dry break with no rail is illegal under BCA handling', () => {
  const game = new AmericanBilliards()
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [],
    cueOffTable: false,
    noCushionAfterContact: true
  })

  assert.equal(res.foul, true)
  assert.equal(res.reason, 'illegal break')
  assert.equal(res.nextPlayer, 'B')
  assert.equal(res.ballInHandNext, true)
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
  assert.equal(game.state.assignments.A, null)
  assert.equal(game.state.assignments.B, null)
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

test('8-ball on break is spotted and does not end frame', () => {
  const game = new AmericanBilliards()
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [8],
    cueOffTable: false
  })

  assert.equal(res.frameOver, false)
  assert.equal(res.foul, false)
  assert.equal(game.state.ballsOnTable.has(8), true)
})

test('potting 8-ball early loses the frame', () => {
  const game = new AmericanBilliards()
  game.state.breakInProgress = false
  game.state.assignments = { A: 'SOLID', B: 'STRIPE' }

  const res = game.shotTaken({
    contactOrder: [8],
    potted: [8],
    cueOffTable: false
  })

  assert.equal(res.frameOver, true)
  assert.equal(res.winner, 'B')
})

test('legal group clearance then 8-ball wins frame', () => {
  const game = new AmericanBilliards()
  game.state.breakInProgress = false
  game.state.assignments = { A: 'SOLID', B: 'STRIPE' }
  game.state.ballsOnTable = new Set([8, 9, 10, 11, 12, 13, 14, 15])

  const res = game.shotTaken({
    contactOrder: [8],
    potted: [8],
    cueOffTable: false
  })

  assert.equal(res.foul, false)
  assert.equal(res.frameOver, true)
  assert.equal(res.winner, 'A')
})


test('8-ball on break plus scratch is loss of frame (BCA)', () => {
  const game = new AmericanBilliards()
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [8, 0],
    cueOffTable: false
  })

  assert.equal(res.frameOver, true)
  assert.equal(res.foul, true)
  assert.equal(res.winner, 'B')
})

test('lone 8-ball on break is spotted and turn passes', () => {
  const game = new AmericanBilliards()
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [8],
    cueOffTable: false
  })

  assert.equal(res.frameOver, false)
  assert.equal(res.foul, false)
  assert.equal(res.nextPlayer, 'B')
  assert.equal(game.state.currentPlayer, 'B')
  assert.equal(game.state.ballsOnTable.has(8), true)
})
