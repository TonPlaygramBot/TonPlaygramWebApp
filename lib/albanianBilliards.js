/** Albanian Billiards: a self-contained 15-ball rotation race to 61. */
export class AlbanianBilliards {
  constructor (options = {}) {
    const requestedTarget = Number(options.targetScore)
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, index) => index + 1)),
      currentPlayer: 'A',
      scores: { A: 0, B: 0 },
      ballInHand: false,
      frameOver: false,
      winner: null,
      breakInProgress: true,
      targetScore: Number.isFinite(requestedTarget) && requestedTarget > 0
        ? Math.floor(requestedTarget)
        : 61
    }
  }

  shotTaken (shot = {}) {
    const state = this.state
    if (state.frameOver) {
      return this.result(true, 'frame over', [], 0)
    }
    const shooter = state.currentPlayer
    const opponent = shooter === 'A' ? 'B' : 'A'
    const contacts = Array.isArray(shot.contactOrder) ? shot.contactOrder : []
    const uniquePots = [...new Set(Array.isArray(shot.potted) ? shot.potted : [])]
    const objectPots = uniquePots.filter((id) => Number.isInteger(id) && id >= 1 && id <= 15 && state.ballsOnTable.has(id))
    const lowest = Math.min(...state.ballsOnTable)
    let reason = ''

    if (uniquePots.includes(0) || shot.cueOffTable) reason = 'scratch'
    else if (contacts.length === 0) reason = 'no contact'
    else if (contacts[0] !== lowest) reason = `wrong first contact (needed ${lowest})`
    else if (objectPots.length === 0 && (shot.noCushionAfterContact || Number(shot.railContactsAfterFirstHit) < 1)) reason = 'no cushion'

    // Object balls remain pocketed on a foul, but never score for the offender.
    objectPots.forEach((id) => state.ballsOnTable.delete(id))
    const foul = Boolean(reason)
    const pointsScored = foul ? 0 : objectPots.reduce((total, id) => total + id, 0)
    if (pointsScored) state.scores[shooter] += pointsScored

    if (state.scores[shooter] >= state.targetScore) {
      state.frameOver = true
      state.winner = shooter
    } else if (state.ballsOnTable.size === 0) {
      state.frameOver = true
      state.winner = state.scores.A === state.scores.B ? 'TIE' : state.scores.A > state.scores.B ? 'A' : 'B'
    }

    const keepTurn = !foul && objectPots.length > 0 && !state.frameOver
    if (!state.frameOver && !keepTurn) state.currentPlayer = opponent
    state.ballInHand = foul && !state.frameOver
    state.breakInProgress = false
    return this.result(foul, reason, uniquePots, pointsScored, keepTurn)
  }

  result (foul, reason, potted, pointsScored, keepTurn = false) {
    return {
      legal: !foul,
      foul,
      reason: foul ? reason : undefined,
      potted,
      pointsScored,
      keepTurn,
      nextPlayer: this.state.currentPlayer,
      ballInHandNext: this.state.ballInHand,
      frameOver: this.state.frameOver,
      winner: this.state.winner,
      scores: { ...this.state.scores }
    }
  }
}

export default AlbanianBilliards
