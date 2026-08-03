/* global describe, test, expect */
import {
  createDominoTableNumber,
  validateDominoStateSubmission
} from '../bot/utils/dominoRoyalOnline.js'

const table = {
  gameType: 'domino-royal',
  players: [{ id: 'TPC-100' }, { id: 'TPC-200' }]
}
const state = (current = 0) => ({
  humanCount: 2,
  current,
  players: [{ hand: [] }, { hand: [] }]
})

describe('Domino Royal online synchronization', () => {
  test('creates a human-readable unique table number', () => {
    const number = createDominoTableNumber(() => false)
    expect(number).toMatch(/^DR-\d{6}$/)
  })

  test('only lets the first TPC seat initialize the table', () => {
    expect(validateDominoStateSubmission({ table, accountId: 'TPC-100', state: state(), action: { type: 'initial' } }).ok).toBe(true)
    expect(validateDominoStateSubmission({ table, accountId: 'TPC-200', state: state(), action: { type: 'initial' } })).toMatchObject({ ok: false, error: 'waiting_for_host' })
  })

  test('only accepts actions from the authoritative current TPC seat', () => {
    const cached = { state: state(1) }
    expect(validateDominoStateSubmission({ table, cached, accountId: 'TPC-100', state: state(1), action: { type: 'play' } })).toMatchObject({ ok: false, error: 'not_your_turn' })
    expect(validateDominoStateSubmission({ table, cached, accountId: 'TPC-200', state: state(0), action: { type: 'turn' } }).ok).toBe(true)
  })
})
