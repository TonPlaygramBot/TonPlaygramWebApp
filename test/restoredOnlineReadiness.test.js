import { buildReadinessSnapshot } from '../bot/config/onlineGamePolicy.js';
import {
  ONLINE_READINESS_BY_GAME,
  getOnlineReadiness
} from '../webapp/src/config/onlineContract.js';

const RESTORED_ONLINE_GAMES = ['texasholdem', 'airhockey', 'murlanroyale'];

describe('restored online game readiness', () => {
  test.each(RESTORED_ONLINE_GAMES)('%s is enabled by both readiness sources', (slug) => {
    const backendReadiness = buildReadinessSnapshot()[slug];
    const clientReadiness = getOnlineReadiness(slug, ONLINE_READINESS_BY_GAME);

    expect(backendReadiness.checks).toEqual({
      lobby: true,
      runtime: true,
      backend: true,
      security: true
    });
    expect(backendReadiness.label).toBe('Online Ready');
    expect(clientReadiness.ready).toBe(true);
    expect(clientReadiness.label).toBe('Online Ready');
  });
});
