import { buildReadinessSnapshot } from '../bot/config/onlineGamePolicy.js';
import fs from 'node:fs';
import {
  ONLINE_READINESS_BY_GAME,
  getOnlineReadiness
} from '../webapp/src/config/onlineContract.js';

const RESTORED_ONLINE_GAMES = ['texasholdem', 'airhockey', 'murlanroyale'];
const RESTORED_ONLINE_LOBBIES = [
  'TexasHoldemLobby.jsx',
  'AirHockeyLobby.jsx',
  'MurlanRoyaleLobby.jsx'
];

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

  test.each(RESTORED_ONLINE_LOBBIES)('%s exposes its online mode', (lobbyFile) => {
    const source = fs.readFileSync(
      new URL(`../webapp/src/pages/Games/${lobbyFile}`, import.meta.url),
      'utf8'
    );
    const onlineOption = source.match(/id: 'online',[\s\S]*?\}/)?.[0];

    expect(onlineOption).toBeDefined();
    expect(onlineOption).not.toContain('disabled: true');
    expect(onlineOption).not.toContain('Temporarily unavailable');
  });
});
