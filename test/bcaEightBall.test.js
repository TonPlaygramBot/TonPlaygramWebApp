import test from 'node:test'
import assert from 'node:assert/strict'
import { BcaEightBall } from '../lib/bcaEightBall.js'

test('legal 8-ball pot wins without foul when black is on', () => {
  const game = new BcaEightBall()
  game.state.breakInProgress = false
  game.state.currentPlayer = 'A'
  game.state.assignments = { A: 'SOLID', B: 'STRIPE' }
  game.state.ballsOnTable = new Set([8])

  const res = game.shotTaken({
    contactOrder: [8],
    potted: [8],
    cueOffTable: false,
    noCushionAfterContact: false
  })

  assert.equal(res.foul, false)
  assert.equal(res.frameOver, true)
  assert.equal(res.winner, 'A')
})
