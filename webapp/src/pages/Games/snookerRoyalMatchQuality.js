const normalizeSeat = (seat) => (seat === 'B' ? 'B' : 'A')

export function resolveSnookerViewerScores (scores, localSeat = 'A') {
  const seat = normalizeSeat(localSeat)
  const playerScore = Number(scores?.[seat] ?? 0)
  const opponentScore = Number(scores?.[seat === 'A' ? 'B' : 'A'] ?? 0)
  return {
    playerScore: Number.isFinite(playerScore) ? playerScore : 0,
    opponentScore: Number.isFinite(opponentScore) ? opponentScore : 0
  }
}

export function buildSnookerViewerHud (state, previousHud = {}, localSeat = 'A') {
  if (!state || typeof state !== 'object') return { ...previousHud }
  const seat = normalizeSeat(localSeat)
  const meta = state.meta && typeof state.meta === 'object' ? state.meta : null
  const metaHud = meta?.hud && typeof meta.hud === 'object' ? meta.hud : null
  const playerTurn = normalizeSeat(state.activePlayer) === seat
  return {
    ...previousHud,
    A: Number(state.players?.A?.score ?? previousHud.A ?? 0),
    B: Number(state.players?.B?.score ?? previousHud.B ?? 0),
    turn: playerTurn ? 0 : 1,
    phase: metaHud?.phase ?? previousHud.phase ?? 'reds',
    next: metaHud?.next ?? previousHud.next ?? 'red',
    inHand: Boolean(meta?.state?.ballInHand),
    over: Boolean(state.frameOver),
    power: 0
  }
}

export function resolveSnookerShotClockExpiry ({ rules, state, localSeat = 'A' }) {
  if (!rules?.applyShot || !state || state.frameOver) return null
  if (normalizeSeat(state.activePlayer) !== normalizeSeat(localSeat)) return null
  return rules.applyShot(
    state,
    [{ type: 'FOUL', reason: 'shot clock expired' }],
    { contactMade: false }
  )
}
