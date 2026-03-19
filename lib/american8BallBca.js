const SOLIDS = 'SOLID'
const STRIPES = 'STRIPE'

export class American8BallBca {
  constructor () {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
      assignments: { A: null, B: null },
      ballInHand: true,
      foulStreak: { A: 0, B: 0 },
      frameOver: false,
      winner: null,
      breakInProgress: true
    }
  }

  shotTaken (shot = {}) {
    const s = this.state
    const current = s.currentPlayer
    const opp = current === 'A' ? 'B' : 'A'
    const contactOrder = Array.isArray(shot.contactOrder) ? shot.contactOrder : []
    const pottedList = Array.isArray(shot.potted) ? shot.potted : []
    const wasBreakShot = Boolean(s.breakInProgress)

    if (s.frameOver) {
      return { legal: false, foul: true, reason: 'frame over', winner: s.winner, frameOver: true }
    }

    const pottedBalls = pottedList.filter((id) => Number.isFinite(id) && id >= 1 && id <= 15)
    const cueScratch = pottedList.includes(0) || shot.cueOffTable
    const first = Number.isFinite(contactOrder[0]) ? contactOrder[0] : null
    const target = this.#legalTargetFor(current)
    let foul = false
    let reason = ''

    if (!first && !wasBreakShot) {
      foul = true
      reason = 'no contact'
    } else if (!wasBreakShot && !this.#isLegalFirstContact(first, target)) {
      foul = true
      reason = 'wrong first contact'
    } else if (!wasBreakShot && shot.noCushionAfterContact && pottedBalls.length === 0) {
      foul = true
      reason = 'no cushion'
    } else if (cueScratch) {
      foul = true
      reason = 'scratch'
    }

    for (const id of pottedBalls) s.ballsOnTable.delete(id)

    if (!foul && s.assignments[current] == null && s.assignments[opp] == null) {
      const solidPotted = pottedBalls.some((id) => id >= 1 && id <= 7)
      const stripePotted = pottedBalls.some((id) => id >= 9 && id <= 15)
      if (solidPotted !== stripePotted) {
        s.assignments[current] = solidPotted ? SOLIDS : STRIPES
        s.assignments[opp] = solidPotted ? STRIPES : SOLIDS
      }
    }

    let frameOver = false
    let winner = null
    const pottedEight = pottedBalls.includes(8)
    const targetIncludesEight = target === 8
    if (pottedEight) {
      if (!foul && targetIncludesEight) {
        frameOver = true
        winner = current
      } else {
        frameOver = true
        winner = opp
      }
    }

    if (frameOver) {
      s.frameOver = true
      s.winner = winner
      s.ballInHand = false
      s.breakInProgress = false
      return { legal: !foul, foul, reason: foul ? reason || 'illegal 8-ball' : undefined, frameOver, winner, nextPlayer: current, ballInHandNext: false }
    }

    let nextPlayer = current
    if (foul || !this.#keepsTurn(current, pottedBalls)) {
      nextPlayer = opp
      s.currentPlayer = opp
    }

    s.ballInHand = foul
    s.foulStreak[current] = foul ? (s.foulStreak[current] ?? 0) + 1 : 0
    s.foulStreak[opp] = foul ? 0 : s.foulStreak[opp] ?? 0
    s.breakInProgress = false

    return {
      legal: !foul,
      foul,
      reason: foul ? reason : undefined,
      potted: pottedList,
      nextPlayer,
      ballInHandNext: foul,
      frameOver: false,
      winner: null
    }
  }

  #groupRemaining (group) {
    if (group === SOLIDS) return Array.from(this.state.ballsOnTable).filter((id) => id >= 1 && id <= 7).length
    if (group === STRIPES) return Array.from(this.state.ballsOnTable).filter((id) => id >= 9 && id <= 15).length
    return 0
  }

  #legalTargetFor (player) {
    const mine = this.state.assignments[player]
    if (!mine) return 'OPEN'
    const mineRemaining = this.#groupRemaining(mine)
    if (mineRemaining === 0) return 8
    return mine
  }

  #isLegalFirstContact (first, target) {
    if (!Number.isFinite(first)) return false
    if (target === 'OPEN') return first >= 1 && first <= 15
    if (target === 8) return first === 8
    if (target === SOLIDS) return first >= 1 && first <= 7
    if (target === STRIPES) return first >= 9 && first <= 15
    return false
  }

  #keepsTurn (player, pottedBalls) {
    if (!Array.isArray(pottedBalls) || pottedBalls.length === 0) return false
    const target = this.#legalTargetFor(player)
    if (target === 'OPEN') {
      return pottedBalls.some((id) => id >= 1 && id <= 7) || pottedBalls.some((id) => id >= 9 && id <= 15)
    }
    if (target === 8) return pottedBalls.includes(8)
    if (target === SOLIDS) return pottedBalls.some((id) => id >= 1 && id <= 7)
    if (target === STRIPES) return pottedBalls.some((id) => id >= 9 && id <= 15)
    return false
  }
}

export default American8BallBca
