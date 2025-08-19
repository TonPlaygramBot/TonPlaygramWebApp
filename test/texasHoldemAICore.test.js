import test from 'node:test'
import assert from 'node:assert/strict'
import { aiChooseAction } from '../lib/texasHoldem.js'

test('ai does not check when facing a bet', () => {
  const hand = [
    { rank: '2', suit: 'H' },
    { rank: '7', suit: 'D' }
  ]
  const action = aiChooseAction(hand, [], 5)
  assert.notEqual(action, 'check')
})

test('ai raises with strong pocket pair', () => {
  const hand = [
    { rank: 'A', suit: 'S' },
    { rank: 'A', suit: 'H' }
  ]
  const action = aiChooseAction(hand, [], 5)
  assert.equal(action, 'raise')
})
