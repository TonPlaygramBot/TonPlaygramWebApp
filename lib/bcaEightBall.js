const SOLIDS = new Set([1, 2, 3, 4, 5, 6, 7])
const STRIPES = new Set([9, 10, 11, 12, 13, 14, 15])

function inferGroup (ballId) {
  if (SOLIDS.has(ballId)) return 'SOLID'
  if (STRIPES.has(ballId)) return 'STRIPE'
  return null
}

function hasGroupBallsLeft (ballsOnTable, group) {
  if (!group) return false
  if (group === 'SOLID') {
    for (const id of SOLIDS) {
      if (ballsOnTable.has(id)) return true
    }
    return false
  }
  for (const id of STRIPES) {
    if (ballsOnTable.has(id)) return true
  }
  return false
}

export class BcaEightBall {
  constructor () {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
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
        winner: s.winner
      }
    }

    const shooter = s.currentPlayer
    const opponent = shooter === 'A' ? 'B' : 'A'
    const shooterGroup = s.assignments[shooter]
    const opponentGroup = s.assignments[opponent]
    const wasBreak = Boolean(s.breakInProgress)
    const first = Number.isFinite(contactOrder[0]) ? contactOrder[0] : null
    const pottedBalls = pottedList.filter((id) => Number.isFinite(id) && id > 0)

    let foul = false
    let reason = ''
    let frameOver = false
    let winner = null
    let nextPlayer = shooter
    let ballInHandNext = false

    const shooterCleared = shooterGroup ? !hasGroupBallsLeft(s.ballsOnTable, shooterGroup) : false
    const legalFirstTargets = (() => {
      if (!shooterGroup) return new Set([...SOLIDS, ...STRIPES])
      if (shooterCleared) return new Set([8])
      return shooterGroup === 'SOLID' ? new Set(SOLIDS) : new Set(STRIPES)
    })()

    if (!wasBreak && !first) {
      foul = true
      reason = 'no contact'
    }

    if (!wasBreak && !foul && !legalFirstTargets.has(first)) {
      foul = true
      reason = 'wrong first contact'
    }

    if (!foul && (pottedList.includes(0) || shot.cueOffTable)) {
      foul = true
      reason = 'scratch'
    }

    if (!wasBreak && !foul && shot.noCushionAfterContact && pottedBalls.length === 0) {
      foul = true
      reason = 'no cushion'
    }

    const eightPotted = pottedBalls.includes(8)
    if (eightPotted) {
      const legalEight = !foul && shooterGroup && shooterCleared && first === 8
      frameOver = true
      winner = legalEight ? shooter : opponent
      s.frameOver = true
      s.winner = winner
      s.ballInHand = false
      s.breakInProgress = false
      return {
        legal: legalEight,
        foul: !legalEight || foul,
        reason: legalEight ? undefined : reason || 'illegal 8-ball pot',
        potted: pottedList,
        nextPlayer: shooter,
        ballInHandNext: false,
        frameOver: true,
        winner
      }
    }

    // Keep all legally potted object balls down.
    for (const id of pottedBalls) {
      if (id >= 1 && id <= 15) s.ballsOnTable.delete(id)
    }

    const nonEightPotted = pottedBalls.filter((id) => id !== 8)
    const ownGroupPotted = shooterGroup
      ? nonEightPotted.some((id) => inferGroup(id) === shooterGroup)
      : false
    const groupPotOnOpenTable = !shooterGroup
      ? nonEightPotted.map((id) => inferGroup(id)).find(Boolean) ?? null
      : null

    if (!foul && !wasBreak && !shooterGroup && groupPotOnOpenTable) {
      s.assignments[shooter] = groupPotOnOpenTable
      s.assignments[opponent] = groupPotOnOpenTable === 'SOLID' ? 'STRIPE' : 'SOLID'
    } else if (!foul && wasBreak && !shooterGroup) {
      // BCA: table stays open after break even if balls are potted.
      s.assignments[shooter] = null
      s.assignments[opponent] = opponentGroup ?? null
    }

    if (foul) {
      nextPlayer = opponent
      ballInHandNext = true
      s.currentPlayer = opponent
      s.foulStreak[shooter] = (s.foulStreak[shooter] ?? 0) + 1
      s.foulStreak[opponent] = 0
    } else {
      s.foulStreak[shooter] = 0
      s.foulStreak[opponent] = 0
      const continuesTurn = ownGroupPotted || (!shooterGroup && Boolean(groupPotOnOpenTable))
      if (!continuesTurn) {
        nextPlayer = opponent
        s.currentPlayer = opponent
      }
    }

    s.ballInHand = ballInHandNext
    if (wasBreak || !foul || nonEightPotted.length > 0 || shot.breakComplete) {
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
      winner
    }
  }
}

export default BcaEightBall
