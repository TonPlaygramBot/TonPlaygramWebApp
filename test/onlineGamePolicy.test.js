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
        mode: 'Ranked',
        tableSize: '9ft',
        token: 'TPC',
        unexpected: 'ignore-me'
      }
    });

    expect(result.ok).toBe(true);
    expect(result.normalizedStake).toBe(25);
    expect(result.normalizedMaxPlayers).toBe(2);
    expect(result.safeMatchMeta).toEqual({ mode: 'Ranked', tableSize: '9ft', token: 'TPC' });
  });

  test('rejects unsupported game and invalid max players', () => {
    expect(validateSeatTableRequest({ gameType: 'unknown', stake: 10, maxPlayers: 2 })).toEqual({
      ok: false,
      error: 'unsupported_game_type'
    });
  });

  test('accepts chess and checkers lobby aliases used by seatTable clients', () => {
    const chess = validateSeatTableRequest({
      gameType: 'chess',
      stake: 100,
      maxPlayers: 2,
      matchMeta: { preferredSide: 'white', mode: 'online' }
    });
    const checkers = validateSeatTableRequest({
      gameType: 'checkers',
      stake: 100,
      maxPlayers: 2,
      matchMeta: { preferredSide: 'black', mode: 'online' }
    });

    expect(chess.ok).toBe(true);
    expect(chess.normalizedGameType).toBe('chess');
    expect(chess.safeMatchMeta).toEqual({ preferredSide: 'white', mode: 'online' });
    expect(checkers.ok).toBe(true);
    expect(checkers.normalizedGameType).toBe('checkers');
    expect(checkers.safeMatchMeta).toEqual({ preferredSide: 'black', mode: 'online' });
  });

  test('normalizes battle royal aliases to shared lobby game types', () => {
    expect(normalizeOnlineGameType('chessbattleroyal')).toBe('chess');
    expect(normalizeOnlineGameType('checkersbattleroyal')).toBe('checkers');
    expect(normalizeOnlineGameType('poolroyale')).toBe('poolroyale');
  });

  test('buildReadinessSnapshot returns all policy games with security checks', () => {
    const snapshot = buildReadinessSnapshot();
    expect(Object.keys(snapshot).sort()).toEqual(Object.keys(GAME_ONLINE_POLICY).sort());

    const sample = snapshot.poolroyale;
    expect(sample.checks).toEqual({ lobby: true, runtime: true, backend: true, security: true });
    expect(sample.securityControls).toEqual(BASE_SECURITY_CONTROLS);
    expect(sample.label).toBe('Online Ready');
  });
});
