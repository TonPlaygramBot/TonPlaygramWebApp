import { randomInt } from 'crypto'

const TABLE_NUMBER_SPACE = 1_000_000
const DOMINO_REQUIRED_MATCH_KEYS = Object.freeze(['mode', 'variant', 'token'])

function normalizeDominoMatchValue (key, value) {
  const normalized = String(value || '').trim()
  if (!normalized) return ''
  if (key === 'token') return normalized.toUpperCase()
  if (key === 'targetPoints') return String(Number(normalized) || '')
  return normalized.toLowerCase()
}

export function resolvePrimaryTpcAccountNumber (payload = {}) {
  return String(
    payload?.tpcAccountNumber ||
      payload?.tpcAccountId ||
      payload?.accountId ||
      payload?.playerId ||
      ''
  ).trim()
}

export function hasConflictingPrimaryTpcIdentities (payload = {}) {
  const primaryIds = [payload?.tpcAccountNumber, payload?.tpcAccountId]
    .map((id) => String(id || '').trim())
    .filter(Boolean)
  if (new Set(primaryIds).size > 1) return true

  // Once a TPG account number is present, it is authoritative for matchmaking.
  // Legacy accountId/playerId fields can lag behind during mobile migrations,
  // so they must not block seating into the lobby.
  if (primaryIds.length > 0) return false

  const fallbackIds = [payload?.accountId, payload?.playerId]
    .map((id) => String(id || '').trim())
    .filter(Boolean)
  return new Set(fallbackIds).size > 1
}

export function isDominoMatchCompatible (existing = {}, requested = {}) {
  for (const key of DOMINO_REQUIRED_MATCH_KEYS) {
    if (normalizeDominoMatchValue(key, existing?.[key]) !== normalizeDominoMatchValue(key, requested?.[key])) {
      return false
    }
  }

  const existingVariant = normalizeDominoMatchValue('variant', existing?.variant)
  const requestedVariant = normalizeDominoMatchValue('variant', requested?.variant)
  if (existingVariant === 'points' || requestedVariant === 'points') {
    return normalizeDominoMatchValue('targetPoints', existing?.targetPoints) === normalizeDominoMatchValue('targetPoints', requested?.targetPoints)
  }

  return true
}

export function createDominoTableNumber (isInUse = () => false) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const number = `DR-${String(randomInt(TABLE_NUMBER_SPACE)).padStart(6, '0')}`
    if (!isInUse(number)) return number
  }
  return `DR-${Date.now().toString(36).toUpperCase()}`
}

export function getDominoPlayerSeat (table, accountId) {
  if (!table || !accountId || !Array.isArray(table.players)) return -1
  return table.players.findIndex(
    (player) => String(player?.id || '') === String(accountId)
  )
}

export function validateDominoStateSubmission ({ table, cached, accountId, state, action }) {
  if (!table || table.gameType !== 'domino-royal') {
    return { ok: false, error: 'table_not_found' }
  }
  const seat = getDominoPlayerSeat(table, accountId)
  if (seat < 0) return { ok: false, error: 'seat_required' }
  if (!state || typeof state !== 'object') return { ok: false, error: 'invalid_state' }

  const playerCount = table.players.length
  if (
    playerCount < 2 ||
    playerCount > 4 ||
    Number(state.humanCount) !== playerCount ||
    !Array.isArray(state.players) ||
    state.players.length !== playerCount
  ) {
    return { ok: false, error: 'invalid_player_count' }
  }

  const actionType = String(action?.type || 'sync')
  if (!cached?.state) {
    if (seat !== 0 || actionType !== 'initial') {
      return { ok: false, error: 'waiting_for_host' }
    }
    return { ok: true, seat }
  }

  const authoritativeTurn = Number(cached.state.current)
  if (!Number.isInteger(authoritativeTurn) || authoritativeTurn !== seat) {
    return { ok: false, error: 'not_your_turn' }
  }
  const nextTurn = Number(state.current)
  const allowedNextTurn = (seat - 1 + playerCount) % playerCount
  if (nextTurn !== seat && nextTurn !== allowedNextTurn) {
    return { ok: false, error: 'invalid_turn_transition' }
  }
  return { ok: true, seat }
}
