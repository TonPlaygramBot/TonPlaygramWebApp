function opponent (p) {
  return p === 'A' ? 'B' : 'A'
}

function groupForBall (id) {
  if (id >= 1 && id <= 7) return 'SOLIDS'
  if (id >= 9 && id <= 15) return 'STRIPES'
  if (id === 8) return 'EIGHT'
  return null
}

function remainingCount (ballsOnTable, group) {
  if (group === 'SOLIDS') {
    return [...ballsOnTable].filter((id) => id >= 1 && id <= 7).length
  }
  if (group === 'STRIPES') {
    return [...ballsOnTable].filter((id) => id >= 9 && id <= 15).length
  }
  return 0
}

export class AmericanEightBall {
  constructor () {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      assignments: { A: null, B: null },
      currentPlayer: 'A',
      ballInHand: true,
      isOpenTable: true,
      breakInProgress: true,
      frameOver: false,
      winner: null
    }
  }

  shotTaken (shot = {}) {
    const s = this.state
    if (s.frameOver) {
      return {
        legal: false,
        foul: true,
        reason: 'frame over',
        potted: [],
        nextPlayer: s.currentPlayer,
        ballInHandNext: false,
        frameOver: true,
        winner: s.winner
      }
    }
    const current = s.currentPlayer
    const opp = opponent(current)
    const contactOrder = Array.isArray(shot.contactOrder) ? shot.contactOrder : []
    const pottedList = Array.isArray(shot.potted) ? shot.potted : []
    const first = contactOrder[0]
    const pottedBalls = pottedList.filter((id) => id !== 0)
    const scratch = pottedList.includes(0) || shot.cueOffTable
    const solidsPotted = pottedBalls.filter((id) => id >= 1 && id <= 7)
    const stripesPotted = pottedBalls.filter((id) => id >= 9 && id <= 15)
    const eightPotted = pottedBalls.includes(8)
    let foul = false
    let reason = ''

    if (!first) {
      foul = true
      reason = 'no contact'
    }

    if (!foul && scratch) {
      foul = true
      reason = 'scratch'
    }

    const ownGroup = s.assignments[current]
    const ownRemaining = ownGroup ? remainingCount(s.ballsOnTable, ownGroup) : 0
    if (!foul && ownGroup) {
      if (ownRemaining > 0) {
        if (groupForBall(first) !== ownGroup) {
          foul = true
          reason = 'wrong first contact'
        }
      } else if (first !== 8) {
        foul = true
        reason = 'must hit 8'
      }
    }

    if (!foul && pottedBalls.length === 0 && shot.noCushionAfterContact) {
      foul = true
      reason = 'no cushion'
    }

    let nextPlayer = current
    let ballInHandNext = false
    let frameOver = false
    let winner = null

    if (eightPotted) {
      if (foul) {
        frameOver = true
        winner = opp
      } else if (s.isOpenTable && s.breakInProgress) {
        frameOver = true
        winner = current
      } else if (s.isOpenTable) {
        frameOver = true
        winner = opp
      } else if (ownGroup && ownRemaining > 0) {
        frameOver = true
        winner = opp
      } else {
        frameOver = true
        winner = current
      }
    }

    if (!frameOver) {
      for (const id of pottedBalls) {
        if (id !== 8) s.ballsOnTable.delete(id)
      }
    }

    if (foul) {
      nextPlayer = opp
      s.currentPlayer = opp
      ballInHandNext = true
    } else {
      if (s.isOpenTable) {
        if (solidsPotted.length && !stripesPotted.length) {
          s.assignments[current] = 'SOLIDS'
          s.assignments[opp] = 'STRIPES'
          s.isOpenTable = false
        } else if (stripesPotted.length && !solidsPotted.length) {
          s.assignments[current] = 'STRIPES'
          s.assignments[opp] = 'SOLIDS'
          s.isOpenTable = false
        }
      }

      const groupAfter = s.assignments[current]
      const pottedOwn =
        s.isOpenTable
          ? solidsPotted.length > 0 || stripesPotted.length > 0
          : groupAfter === 'SOLIDS'
            ? solidsPotted.length > 0
            : groupAfter === 'STRIPES'
              ? stripesPotted.length > 0
              : false
      if (!pottedOwn && !eightPotted) {
        nextPlayer = opp
        s.currentPlayer = opp
      }
    }

    if (frameOver) {
      s.frameOver = true
      s.winner = winner
    }
    s.ballInHand = ballInHandNext
    s.breakInProgress = false

    return {
      legal: !foul,
      foul,
      reason: foul ? reason : undefined,
      potted: pottedList,
      nextPlayer,
      ballInHandNext,
      frameOver,
      winner: frameOver ? winner : undefined
    }
  }
}

export default AmericanEightBall
