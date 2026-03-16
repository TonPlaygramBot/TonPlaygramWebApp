export const WHITE = 'white'
export const BLACK = 'black'

export const initialBoard = () => {
  const points = Array.from({ length: 24 }, () => ({ color: null, count: 0 }))
  const set = (i, color, count) => {
    points[i] = { color, count }
  }
  set(23, WHITE, 2)
  set(12, WHITE, 5)
  set(7, WHITE, 3)
  set(5, WHITE, 5)
  set(0, BLACK, 2)
  set(11, BLACK, 5)
  set(16, BLACK, 3)
  set(18, BLACK, 5)
  return points
}

export const cloneState = (state) => ({
  points: state.points.map((p) => ({ ...p })),
  bar: { ...state.bar },
  off: { ...state.off }
})

const other = (color) => (color === WHITE ? BLACK : WHITE)
const dirFor = (color) => (color === WHITE ? -1 : 1)
const homeRange = (color) => (color === WHITE ? [0, 5] : [18, 23])
const canLand = (point, color) => !point.color || point.color === color || point.count === 1

export const canBearOff = (state, color) => {
  if (state.bar[color] > 0) return false
  const [start, end] = homeRange(color)
  for (let i = 0; i < 24; i += 1) {
    if (i < start || i > end) {
      const p = state.points[i]
      if (p.color === color && p.count > 0) return false
    }
  }
  return true
}

const hasHigherHomeChecker = (state, color, from) => {
  if (color === WHITE) {
    for (let i = from + 1; i <= 5; i += 1) {
      const p = state.points[i]
      if (p.color === WHITE && p.count > 0) return true
    }
    return false
  }
  for (let i = from - 1; i >= 18; i -= 1) {
    const p = state.points[i]
    if (p.color === BLACK && p.count > 0) return true
  }
  return false
}

const destinationForBar = (color, die) => (color === WHITE ? 24 - die : die - 1)

export const getSingleDieMoves = (state, color, die) => {
  const moves = []
  if (state.bar[color] > 0) {
    const dest = destinationForBar(color, die)
    if (dest >= 0 && dest < 24 && canLand(state.points[dest], color)) {
      moves.push({ from: 'bar', to: dest, die })
    }
    return moves
  }

  const direction = dirFor(color)
  const canOff = canBearOff(state, color)

  for (let i = 0; i < 24; i += 1) {
    const p = state.points[i]
    if (p.color !== color || p.count <= 0) continue
    const dest = i + direction * die

    if (dest >= 0 && dest < 24) {
      if (canLand(state.points[dest], color)) moves.push({ from: i, to: dest, die })
      continue
    }

    if (!canOff) continue
    if (color === WHITE && dest < 0) {
      const exact = i - die === -1
      if (exact || !hasHigherHomeChecker(state, color, i)) moves.push({ from: i, to: 'off', die })
    }
    if (color === BLACK && dest > 23) {
      const exact = i + die === 24
      if (exact || !hasHigherHomeChecker(state, color, i)) moves.push({ from: i, to: 'off', die })
    }
  }

  return moves
}

export const applyMove = (state, color, move) => {
  const next = cloneState(state)
  if (move.from === 'bar') {
    next.bar[color] -= 1
  } else {
    const fromPoint = next.points[move.from]
    fromPoint.count -= 1
    if (fromPoint.count === 0) fromPoint.color = null
  }

  if (move.to === 'off') {
    next.off[color] += 1
    return next
  }

  const toPoint = next.points[move.to]
  if (toPoint.color === other(color) && toPoint.count === 1) {
    toPoint.color = color
    toPoint.count = 1
    next.bar[other(color)] += 1
    return next
  }

  if (!toPoint.color) toPoint.color = color
  toPoint.count += 1
  return next
}

const permutationsForDice = (dice) => {
  if (dice.length !== 2 || dice[0] === dice[1]) return [dice]
  return [dice, [dice[1], dice[0]]]
}

const dedupeTurnSequences = (sequences) => {
  const seen = new Set()
  return sequences.filter((seq) => {
    const key = JSON.stringify(seq.line)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const collectTurnSequences = (state, color, dice) => {
  const sequences = []
  const recurse = (currentState, diceLeft, line = [], used = []) => {
    if (!diceLeft.length) {
      sequences.push({ line, usedDice: used, resultingState: currentState })
      return
    }
    const [die, ...rest] = diceLeft
    const options = getSingleDieMoves(currentState, color, die)
    if (!options.length) {
      sequences.push({ line, usedDice: used, resultingState: currentState })
      return
    }
    options.forEach((mv) => recurse(applyMove(currentState, color, mv), rest, [...line, mv], [...used, die]))
  }

  permutationsForDice(dice).forEach((order) => recurse(state, order))

  const maxUsed = sequences.reduce((max, s) => Math.max(max, s.usedDice.length), 0)
  let filtered = sequences.filter((s) => s.usedDice.length === maxUsed)

  if (maxUsed === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const higher = Math.max(...dice)
    if (getSingleDieMoves(state, color, higher).length > 0) {
      filtered = filtered.filter((s) => s.usedDice[0] === higher)
    }
  }

  return dedupeTurnSequences(filtered)
}

const pointDanger = (state, pointIdx, color) => {
  const enemy = other(color)
  let danger = 0
  for (let die = 1; die <= 6; die += 1) {
    const from = color === WHITE ? pointIdx + die : pointIdx - die
    if (from < 0 || from > 23) continue
    const p = state.points[from]
    if (p.color !== enemy || p.count <= 0) continue
    const landing = state.points[pointIdx]
    if (!landing || (landing.color === color && landing.count > 1)) continue
    danger += 1
  }
  return danger
}

export const scorePosition = (state, color) => {
  const opp = other(color)
  const pip = (player) => {
    let total = state.bar[player] * 25
    for (let i = 0; i < 24; i += 1) {
      const p = state.points[i]
      if (p.color !== player) continue
      const distance = player === WHITE ? i + 1 : 24 - i
      total += p.count * distance
    }
    return total
  }

  let blots = 0
  let anchors = 0
  let danger = 0
  for (let i = 0; i < 24; i += 1) {
    const p = state.points[i]
    if (p.color !== color || p.count <= 0) continue
    if (p.count === 1) {
      blots += 1
      danger += pointDanger(state, i, color)
    }
    if (p.count >= 2) anchors += 1
  }

  return (
    (pip(opp) - pip(color)) * 1.1 +
    (state.off[color] - state.off[opp]) * 30 +
    (state.bar[opp] - state.bar[color]) * 16 +
    anchors * 1.6 -
    blots * 2.3 -
    danger * 1.5
  )
}

const allDiceOutcomes = () => {
  const out = []
  for (let d1 = 1; d1 <= 6; d1 += 1) {
    for (let d2 = 1; d2 <= 6; d2 += 1) out.push(d1 === d2 ? [d1, d1, d1, d1] : [d1, d2])
  }
  return out
}

const DICE_OUTCOMES = allDiceOutcomes()

const bestImmediateSequence = (state, color, dice) => {
  const sequences = collectTurnSequences(state, color, dice)
  if (!sequences.length) return null
  return sequences.reduce((best, seq) => (scorePosition(seq.resultingState, color) > scorePosition(best.resultingState, color) ? seq : best), sequences[0])
}

export const pickAiSequence = (state, dice) => {
  const aiSequences = collectTurnSequences(state, BLACK, dice)
  if (!aiSequences.length) return null

  const evaluateAfterAi = (afterAi) => {
    let total = 0
    DICE_OUTCOMES.forEach((whiteDice) => {
      const whiteBest = bestImmediateSequence(afterAi, WHITE, whiteDice)
      const afterWhite = whiteBest?.resultingState || afterAi
      total += scorePosition(afterWhite, BLACK)
    })
    return total / DICE_OUTCOMES.length
  }

  return aiSequences.reduce((best, seq) => (evaluateAfterAi(seq.resultingState) > evaluateAfterAi(best.resultingState) ? seq : best), aiSequences[0])
}

export const formatMove = (move) => {
  const from = move.from === 'bar' ? 'Bar' : `P${Number(move.from) + 1}`
  const to = move.to === 'off' ? 'Off' : `P${Number(move.to) + 1}`
  return `${from} → ${to} (${move.die})`
}
