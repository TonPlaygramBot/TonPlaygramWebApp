/* global describe, test, expect */
import {
  createDominoTableNumber,
  hasConflictingPrimaryTpcIdentities,
  isDominoMatchCompatible,
  resolvePrimaryTpcAccountNumber,
  validateDominoStateSubmission
} from '../bot/utils/dominoRoyalOnline.js'

const table = {
  gameType: 'domino-royal',
  players: [{ id: 'TPG-100' }, { id: 'TPG-200' }]
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

  test('only lets the first TPG seat initialize the table', () => {
    expect(validateDominoStateSubmission({ table, accountId: 'TPG-100', state: state(), action: { type: 'initial' } }).ok).toBe(true)
    expect(validateDominoStateSubmission({ table, accountId: 'TPG-200', state: state(), action: { type: 'initial' } })).toMatchObject({ ok: false, error: 'waiting_for_host' })
  })

  test('only accepts actions from the authoritative current TPG seat', () => {
    const cached = { state: state(1) }
    expect(validateDominoStateSubmission({ table, cached, accountId: 'TPG-100', state: state(1), action: { type: 'play' } })).toMatchObject({ ok: false, error: 'not_your_turn' })
    expect(validateDominoStateSubmission({ table, cached, accountId: 'TPG-200', state: state(0), action: { type: 'turn' } }).ok).toBe(true)
  })

  test('uses the TPG account number as the primary lobby identity', () => {
    const payload = {
      tpcAccountNumber: 'TPG-777',
      accountId: 'legacy-local-storage-id',
      playerId: 'legacy-player-id'
    }

    expect(resolvePrimaryTpcAccountNumber(payload)).toBe('TPG-777')
    expect(hasConflictingPrimaryTpcIdentities(payload)).toBe(false)
    expect(hasConflictingPrimaryTpcIdentities({ tpcAccountNumber: 'TPG-1', tpcAccountId: 'TPG-2' })).toBe(true)
  })

  test('matches Domino Royal lobbies by stake-compatible game rules', () => {
    expect(isDominoMatchCompatible(
      { mode: 'online', variant: 'single', token: 'tpg' },
      { mode: 'ONLINE', variant: 'SINGLE', token: 'TPG', targetPoints: '0' }
    )).toBe(true)

    expect(isDominoMatchCompatible(
      { mode: 'online', variant: 'points', token: 'TPG', targetPoints: '51' },
      { mode: 'online', variant: 'points', token: 'TPG', targetPoints: 101 }
    )).toBe(false)
  })
})
