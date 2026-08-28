import {
  TPG_GAME_CONTRACTS,
  getTpgGameContract
} from '../bot/config/tpgGameContracts.js';

describe('TPG game smart contract API descriptors', () => {
  test('every online lobby game uses private TPG identity and public profile fields', () => {
    expect(Object.keys(TPG_GAME_CONTRACTS)).toHaveLength(22);
    for (const contract of Object.values(TPG_GAME_CONTRACTS)) {
      expect(contract.token).toBe('TPG');
      expect(contract.identity).toBe('tpcAccountNumber');
      expect(contract.publicPlayerFields).toEqual(['name', 'avatar']);
      expect(contract.matchmaking).toContain('stake');
    }
  });

  test('registers every Visual Royal release for same-stake standard-rules matchmaking', () => {
    for (const gameType of [
      'tabletennis', 'tenpinbowling', 'darts', 'carrom', 'archery',
      'penaltyshootout', 'basketball', 'gocrazykart'
    ]) {
      expect(TPG_GAME_CONTRACTS[gameType].matchmaking).toEqual(['stake', 'rules']);
    }
  });

  test('keeps each game option logic separate', () => {
    expect(getTpgGameContract('chess').matchmaking).toEqual(['stake']);
    expect(getTpgGameContract('domino-royal').matchmaking).toEqual([
      'stake',
      'variant',
      'targetPoints',
      'players'
    ]);
    expect(getTpgGameContract('texasholdem').matchmaking).toEqual([
      'stake',
      'tableSize',
      'gameMode',
      'buyIn'
    ]);
    expect(getTpgGameContract('airhockey').matchmaking).toEqual([
      'stake',
      'winScore',
      'arena'
    ]);
    expect(getTpgGameContract('murlanroyale').matchmaking).toEqual([
      'stake',
      'variant',
      'targetPoints',
      'players',
      'rules'
    ]);
  });
});
