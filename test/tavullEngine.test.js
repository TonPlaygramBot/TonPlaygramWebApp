import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BLACK,
  WHITE,
  applyMove,
  collectTurnSequences,
  getSingleDieMoves,
  initialBoard,
  pickAiSequence
} from '../webapp/src/utils/tavullEngine.js'

const createState = () => ({ points: initialBoard(), bar: { white: 0, black: 0 }, off: { white: 0, black: 0 } })

test('bar entry is forced before other checker moves', () => {
  const state = createState()
  state.bar.white = 1
  const dieMoves = getSingleDieMoves(state, WHITE, 6)
  assert.ok(dieMoves.every((move) => move.from === 'bar'))
})

test('turn sequences enforce using the maximum number of dice', () => {
  const state = createState()
  const sequences = collectTurnSequences(state, WHITE, [3, 1])
  assert.ok(sequences.length > 0)
  const usedCounts = sequences.map((entry) => entry.usedDice.length)
  assert.ok(usedCounts.every((count) => count === Math.max(...usedCounts)))
})

test('hitting a blot sends checker to bar', () => {
  const state = {
    points: Array.from({ length: 24 }, () => ({ color: null, count: 0 })),
    bar: { white: 0, black: 0 },
    off: { white: 0, black: 0 }
  }
  state.points[10] = { color: WHITE, count: 1 }
  state.points[9] = { color: BLACK, count: 1 }
  const moved = applyMove(state, WHITE, { from: 10, to: 9, die: 1 })
  assert.equal(moved.points[9].color, WHITE)
  assert.equal(moved.points[9].count, 1)
  assert.equal(moved.bar.black, 1)
})

test('AI picks a legal sequence for black', () => {
  const state = createState()
  const dice = [4, 2]
  const ai = pickAiSequence(state, dice)
  const legal = collectTurnSequences(state, BLACK, dice)
  assert.ok(ai)
  assert.ok(legal.some((option) => JSON.stringify(option.line) === JSON.stringify(ai.line)))
})
