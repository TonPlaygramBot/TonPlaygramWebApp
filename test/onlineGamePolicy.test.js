import { describe, expect, test } from '@jest/globals';
import {
  GAME_ONLINE_POLICY,
  normalizeOnlineGameType,
  validateSeatTableRequest,
  buildReadinessSnapshot,
  BASE_SECURITY_CONTROLS
} from '../bot/config/onlineGamePolicy.js';

describe('online game policy', () => {
  test('accepts valid matchmaking payload and sanitizes metadata', () => {
    const result = validateSeatTableRequest({
      gameType: 'poolroyale',
      stake: '25',
      maxPlayers: 2,
      matchMeta: {
        variant: '8ball',
        mode: 'ONLINE',
        tableSize: '9ft',
        token: 'TPG',
        unexpected: 'ignore-me'
      }
    });

    expect(result.ok).toBe(true);
    expect(result.normalizedStake).toBe(25);
    expect(result.normalizedMaxPlayers).toBe(2);
    expect(result.safeMatchMeta).toEqual({
      variant: '8ball',
      mode: 'online',
      tableSize: '9ft',
      token: 'TPG'
    });
  });

  test('rejects unsupported game and invalid max players', () => {
    expect(
      validateSeatTableRequest({
        gameType: 'unknown',
        stake: 10,
        maxPlayers: 2
      })
    ).toEqual({
      ok: false,
      error: 'unsupported_game_type'
    });
  });

  test('accepts chess and checkers lobby aliases used by seatTable clients', () => {
    const chess = validateSeatTableRequest({
      gameType: 'chess',
      stake: 100,
      maxPlayers: 2,
      matchMeta: { preferredSide: 'white', mode: 'online', token: 'TPG' }
    });
    const checkers = validateSeatTableRequest({
      gameType: 'checkers',
      stake: 100,
      maxPlayers: 2,
      matchMeta: { preferredSide: 'black', mode: 'online', token: 'TPG' }
    });

    expect(chess.ok).toBe(true);
    expect(chess.normalizedGameType).toBe('chess');
    expect(chess.safeMatchMeta).toEqual({
      preferredSide: 'white',
      mode: 'online',
      token: 'TPG'
    });
    expect(checkers.ok).toBe(true);
    expect(checkers.normalizedGameType).toBe('checkers');
    expect(checkers.safeMatchMeta).toEqual({
      preferredSide: 'black',
      mode: 'online',
      token: 'TPG'
    });
  });

  test.each([
    [
      {
        gameType: 'poolroyale',
        stake: 100,
        maxPlayers: 2,
        matchMeta: { mode: 'online', token: 'TON' }
      },
      'invalid_stake_token'
    ],
    [
      {
        gameType: 'poolroyale',
        stake: 100,
        maxPlayers: 2,
        matchMeta: { mode: 'ai', token: 'TPG' }
      },
      'invalid_game_mode'
    ],
    [
      {
        gameType: 'poolroyale',
        stake: 0,
        maxPlayers: 2,
        matchMeta: { mode: 'online', token: 'TPG' }
      },
      'invalid_stake'
    ],
    [
      {
        gameType: 'poolroyale',
        stake: 1.5,
        maxPlayers: 2,
        matchMeta: { mode: 'online', token: 'TPG' }
      },
      'invalid_stake'
    ]
  ])(
    'rejects a lobby request outside the TPG stake contract %#',
    (payload, error) => {
      expect(validateSeatTableRequest(payload)).toEqual({ ok: false, error });
    }
  );

  test('accepts and canonicalizes all Domino Royal matchmaking criteria', () => {
    const result = validateSeatTableRequest({
      gameType: 'domino-royal',
      stake: '100',
      maxPlayers: '4',
      matchMeta: {
        variant: 'Points',
        targetPoints: 101,
        mode: 'ONLINE',
        token: 'tpg'
      }
    });

    expect(result).toMatchObject({
      ok: true,
      normalizedStake: 100,
      normalizedMaxPlayers: 4,
      safeMatchMeta: {
        variant: 'points',
        targetPoints: '101',
        mode: 'online',
        token: 'TPG'
      }
    });
  });

  test.each([2, 3, 4])(
    'accepts %i-player Murlan single and tournament tables',
    (maxPlayers) => {
      const single = validateSeatTableRequest({
        gameType: 'murlanroyale',
        stake: 100,
        maxPlayers,
        matchMeta: { variant: 'single', mode: 'online', token: 'TPG' }
      });
      const tournament = validateSeatTableRequest({
        gameType: 'murlanroyale',
        stake: 100,
        maxPlayers,
        matchMeta: {
          variant: 'tournament',
          targetPoints: 21,
          mode: 'online',
          token: 'TPG'
        }
      });

      expect(single).toMatchObject({
        ok: true,
        normalizedMaxPlayers: maxPlayers,
        safeMatchMeta: { variant: 'single', mode: 'online', token: 'TPG' }
      });
      expect(tournament).toMatchObject({
        ok: true,
        normalizedMaxPlayers: maxPlayers,
        safeMatchMeta: {
          variant: 'tournament',
          targetPoints: '21',
          mode: 'online',
          token: 'TPG'
        }
      });
    }
  );

  test.each([2, 3, 4, 5, 6, 7, 8])(
    'accepts %i-player Texas Holdem tables with adapted queue criteria',
    (maxPlayers) => {
      expect(
        validateSeatTableRequest({
          gameType: 'texasholdem',
          stake: 100,
          maxPlayers,
          matchMeta: {
            tableSize: maxPlayers,
            gameMode: 'standard',
            buyIn: 100,
            mode: 'online',
            token: 'TPG'
          }
        })
      ).toMatchObject({
        ok: true,
        normalizedMaxPlayers: maxPlayers,
        safeMatchMeta: {
          tableSize: String(maxPlayers),
          gameMode: 'standard',
          buyIn: '100'
        }
      });
    }
  );

  test('keeps Air Hockey score and arena selections in its queue', () => {
    expect(
      validateSeatTableRequest({
        gameType: 'airhockey',
        stake: 100,
        maxPlayers: 2,
        matchMeta: {
          winScore: 11,
          arena: 'regular',
          mode: 'online',
          token: 'TPG'
        }
      })
    ).toMatchObject({
      ok: true,
      safeMatchMeta: { winScore: '11', arena: 'regular' }
    });
  });

  test.each([
    [
      { variant: 'rounds', mode: 'online', token: 'TPG' },
      'invalid_game_variant'
    ],
    [
      { variant: 'single', mode: 'online', token: 'TON' },
      'invalid_stake_token'
    ],
    [{ variant: 'single', mode: 'local', token: 'TPG' }, 'invalid_game_mode'],
    [
      { variant: 'points', targetPoints: 75, mode: 'online', token: 'TPG' },
      'invalid_target_points'
    ]
  ])('rejects invalid Domino Royal criteria %#', (matchMeta, error) => {
    expect(
      validateSeatTableRequest({
        gameType: 'domino-royal',
        stake: 100,
        maxPlayers: 4,
        matchMeta
      })
    ).toEqual({ ok: false, error });
  });

  test('normalizes battle royal aliases to shared lobby game types', () => {
    expect(normalizeOnlineGameType('chessbattleroyal')).toBe('chess');
    expect(normalizeOnlineGameType('Chess Battle Royal')).toBe('chess');
    expect(normalizeOnlineGameType('chess-battle-royale')).toBe('chess');
    expect(normalizeOnlineGameType('checkersbattleroyal')).toBe('checkers');
    expect(normalizeOnlineGameType('Checkers Battle Royal')).toBe('checkers');
    expect(normalizeOnlineGameType('fourinrowroyale')).toBe('fourinrow');
    expect(normalizeOnlineGameType('poolroyale')).toBe('poolroyale');
  });

  test('buildReadinessSnapshot returns all policy games with security checks', () => {
    const snapshot = buildReadinessSnapshot();
    expect(Object.keys(snapshot).sort()).toEqual(
      [
        ...Object.keys(GAME_ONLINE_POLICY),
        'fourinrowroyale', 'tabletennisroyal', 'tenpinbowlingroyal',
        'dartsroyal', 'carromroyal', 'archeryroyal',
        'penaltyshootoutroyal', 'basketballroyal', 'gocrazykartarena'
      ].sort()
    );

    const sample = snapshot.poolroyale;
    expect(sample.checks).toEqual({
      lobby: true,
      runtime: true,
      backend: true,
      security: true
    });
    expect(sample.securityControls).toEqual(BASE_SECURITY_CONTROLS);
    expect(sample.label).toBe('Online Ready');
  });
});
