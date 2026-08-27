import { describe, expect, test } from '@jest/globals'
import { canControlCheckersTurn } from '../webapp/src/pages/Games/shared/checkersTurnControl.js'

describe('checkers turn control', () => {
  test.each([
    ['light', 'light'],
    ['dark', 'dark']
  ])('allows the online %s player to control the %s turn', (playerSide, activeTurn) => {
    expect(
      canControlCheckersTurn({ isOnlineGame: true, activeTurn, playerSide })
    ).toBe(true)
  })

  test.each([
    ['light', 'dark'],
    ['dark', 'light']
  ])('blocks the online %s player during the %s turn', (playerSide, activeTurn) => {
    expect(
      canControlCheckersTurn({ isOnlineGame: true, activeTurn, playerSide })
    ).toBe(false)
  })

  test('keeps the dark side AI-controlled in offline play', () => {
    expect(
      canControlCheckersTurn({
        isOnlineGame: false,
        activeTurn: 'dark',
        playerSide: 'dark'
      })
    ).toBe(false)
  })
})
