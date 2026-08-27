export function canControlCheckersTurn ({ isOnlineGame, activeTurn, playerSide }) {
  if (isOnlineGame) return activeTurn === playerSide
  return activeTurn === 'light'
}
