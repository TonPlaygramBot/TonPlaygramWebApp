const CONTRACTS = {
  poolroyale: ['variant'],
  snookerroyale: ['playType', 'tableSize'],
  snookerchampion: ['playType', 'tableSize'],
  snake: ['board', 'rules'],
  chess: [],
  checkers: ['rules'],
  fourinrow: ['boardSize'],
  backgammon: ['rules'],
  'domino-royal': ['variant', 'targetPoints', 'players'],
  ludobattleroyal: ['players', 'rules'],
  texasholdem: ['tableSize', 'gameMode', 'buyIn'],
  airhockey: ['winScore', 'arena'],
  murlanroyale: ['players', 'rules'],
  shootingrange: ['mode', 'difficulty']
};

export const TPG_GAME_CONTRACTS = Object.freeze(
  Object.fromEntries(
    Object.entries(CONTRACTS).map(([gameType, optionKeys]) => [
      gameType,
      Object.freeze({
        gameType,
        token: 'TPG',
        identity: 'tpcAccountNumber',
        publicPlayerFields: Object.freeze(['name', 'avatar']),
        matchmaking: Object.freeze(['stake', ...optionKeys])
      })
    ])
  )
);

export function getTpgGameContract(gameType = '') {
  return TPG_GAME_CONTRACTS[String(gameType).trim().toLowerCase()] || null;
}
