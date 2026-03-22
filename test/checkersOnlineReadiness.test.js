import { describe, expect, test } from '@jest/globals';
import {
  ONLINE_READINESS_BY_GAME,
  getOnlineReadiness
} from '../webapp/src/config/onlineContract.js';

describe('checkers online readiness contract', () => {
  test('marks checkers battle royal as online ready in local fallback map', () => {
    expect(ONLINE_READINESS_BY_GAME.checkersbattleroyal).toBeDefined();
    const readiness = getOnlineReadiness('checkersbattleroyal', ONLINE_READINESS_BY_GAME);
    expect(readiness.ready).toBe(true);
    expect(readiness.label).toBe('Online Ready');
    expect(readiness.checks).toEqual({
      lobby: true,
      runtime: true,
      backend: true,
      security: true
    });
  });
});
