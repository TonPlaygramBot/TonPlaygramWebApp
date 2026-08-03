import test from 'node:test'
import assert from 'node:assert/strict'

import { isDominoMatchCompatible } from '../utils/dominoRoyalOnline.js'

test('Domino matchmaking seats players with identical criteria together', () => {
  const criteria = {
    mode: 'online',
    variant: 'points',
    targetPoints: '101',
    token: 'tpc'
  }

  assert.equal(isDominoMatchCompatible(criteria, { ...criteria }), true)
})

test('Domino matchmaking keeps different game criteria in separate queues', () => {
  const criteria = {
    mode: 'online',
    variant: 'points',
    targetPoints: '101',
    token: 'tpc'
  }

  assert.equal(
    isDominoMatchCompatible(criteria, { ...criteria, targetPoints: '51' }),
    false
  )
  assert.equal(
    isDominoMatchCompatible(criteria, { ...criteria, variant: 'single' }),
    false
  )
  assert.equal(
    isDominoMatchCompatible(criteria, { ...criteria, token: 'ton' }),
    false
  )
})

test('Domino matchmaking does not treat missing criteria as wildcards', () => {
  assert.equal(
    isDominoMatchCompatible(
      { mode: 'online', variant: 'single', token: 'tpc' },
      { mode: 'online', token: 'tpc' }
    ),
    false
  )
})
