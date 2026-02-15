export class AmericanBilliards {
  constructor () {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
      scores: { A: 0, B: 0 },
      assignments: { A: null, B: null },
      ballInHand: false,
      foulStreak: { A: 0, B: 0 },
      frameOver: false,
      winner: null,
      breakInProgress: true
    }
  }

  shotTaken (shot = {}) {
    const s = this.state
    const contactOrder = Array.isArray(shot.contactOrder) ? shot.contactOrder : []
    const pottedList = Array.isArray(shot.potted) ? shot.potted : []

    if (s.frameOver) {
      return {
        legal: false,
        foul: true,
        reason: 'frame over',
        potted: [],
        nextPlayer: s.currentPlayer,
        ballInHandNext: false,
        frameOver: true,
        winner: s.winner,
        scores: { ...s.scores }
      }
    }

    const current = s.currentPlayer
    const opp = current === 'A' ? 'B' : 'A'
    const wasBreakShot = Boolean(s.breakInProgress)
    let foul = false
    let reason = ''

    const first = contactOrder[0]
    const playerGroup = s.assignments[current]
    const opponentGroup = s.assignments[opp]
    const isOpenTable = !playerGroup || !opponentGroup
    const playerGroupRemaining =
      playerGroup === 'SOLID'
        ? countRemainingGroup(s.ballsOnTable, 'SOLID')
        : playerGroup === 'STRIPE'
          ? countRemainingGroup(s.ballsOnTable, 'STRIPE')
          : 0

    if (!foul && !wasBreakShot && !first) {
      foul = true
      reason = 'no contact'
    }

    if (!foul && first != null && !isLegalFirstContact(first, { isOpenTable, playerGroup, playerGroupRemaining })) {
      foul = true
      reason = 'wrong first contact'
    }

    if (!foul && (pottedList.includes(0) || shot.cueOffTable)) {
      foul = true
      reason = 'scratch'
    }

    const pottedBalls = pottedList.filter(id => id !== 0)
    if (!foul && !wasBreakShot && shot.noCushionAfterContact && pottedBalls.length === 0) {
      foul = true
      reason = 'no cushion'
    }

    let nextPlayer = current
    let ballInHandNext = false
    let frameOver = false
    let winner = null

    if (foul) {
      nextPlayer = opp
      s.currentPlayer = opp
      ballInHandNext = true
      s.foulStreak[current] = (s.foulStreak[current] ?? 0) + 1
      s.foulStreak[opp] = 0
      // BCA: balls pocketed on a foul stay down except the 8-ball.
      for (const id of pottedBalls) {
        if (id !== 8) s.ballsOnTable.delete(id)
      }
    } else {
      s.foulStreak[current] = 0
      s.foulStreak[opp] = 0

      if (isOpenTable && !s.breakInProgress) {
        const groupBall = pottedBalls.find(id => id !== 8)
        if (groupBall) {
          const group = idToGroup(groupBall)
          s.assignments[current] = group
          s.assignments[opp] = oppositeGroup(group)
        }
      }

      for (const id of pottedBalls) {
        if (!s.ballsOnTable.has(id) || id === 8) continue
        s.ballsOnTable.delete(id)
        s.scores[current] = (s.scores[current] ?? 0) + 1
      }
    }

    const eightPotted = pottedBalls.includes(8)
    if (!frameOver && eightPotted) {
      if (s.breakInProgress) {
        // BCA break: 8-ball is spotted and play continues.
        s.ballsOnTable.add(8)
      } else {
        const currentGroup = s.assignments[current]
        const remainingBeforeEight =
          currentGroup === 'SOLID'
            ? countRemainingGroup(s.ballsOnTable, 'SOLID')
            : currentGroup === 'STRIPE'
              ? countRemainingGroup(s.ballsOnTable, 'STRIPE')
              : 0
        const legalEight = !foul && currentGroup && remainingBeforeEight === 0
        frameOver = true
        winner = legalEight ? current : opp
        s.ballsOnTable.delete(8)
      }
    }

    if (!frameOver) {
      if (foul) {
        nextPlayer = opp
      } else if (pottedBalls.length > 0) {
        nextPlayer = current
      } else {
        nextPlayer = opp
        s.currentPlayer = opp
      }
    }

    s.ballInHand = ballInHandNext
    if (wasBreakShot || !foul || pottedBalls.length > 0 || shot.breakComplete) {
      s.breakInProgress = false
    }
    s.frameOver = frameOver
    s.winner = winner

    return {
      legal: !foul,
      foul,
      reason: foul ? reason : undefined,
      potted: pottedList,
      nextPlayer,
      ballInHandNext,
      frameOver,
      winner,
      scores: { ...s.scores }
    }
  }
}

export default AmericanBilliards

function idToGroup (id) {
  if (id >= 1 && id <= 7) return 'SOLID'
  if (id >= 9 && id <= 15) return 'STRIPE'
  return null
}

function oppositeGroup (group) {
  return group === 'SOLID' ? 'STRIPE' : 'SOLID'
}

function countRemainingGroup (balls, group) {
  let total = 0
  for (const id of balls) {
    if (group === 'SOLID' && id >= 1 && id <= 7) total += 1
    if (group === 'STRIPE' && id >= 9 && id <= 15) total += 1
  }
  return total
}

function isLegalFirstContact (first, { isOpenTable, playerGroup, playerGroupRemaining }) {
  if (!Number.isFinite(first)) return false
  if (isOpenTable) return first !== 8
  if (playerGroupRemaining <= 0) return first === 8
  if (playerGroup === 'SOLID') return first >= 1 && first <= 7
  if (playerGroup === 'STRIPE') return first >= 9 && first <= 15
  return false
}
