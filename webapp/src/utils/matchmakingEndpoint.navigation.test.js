import { describe, expect, it } from 'vitest';
import { resolveChessEndpoint } from './matchmakingEndpoint.js';

const production = 'https://tonplaygram-bot.onrender.com';
describe('single-service matchmaking address', () => {
  it('uses the main API when the old standalone host remains in the build environment', () => {
    expect(resolveChessEndpoint({ configured: 'wss://tonplaygram-chess-matchmaking.onrender.com', apiBase: production, pageUrl: `${production}/games` })).toBe(`${production.replace('https', 'wss')}/colyseus`);
  });
  it('uses the main API inside a native localhost shell', () => {
    expect(resolveChessEndpoint({ apiBase: production, pageUrl: 'capacitor://localhost/games', native: true })).toBe('wss://tonplaygram-bot.onrender.com/colyseus');
  });
  it('supports the local main server and an explicit standalone development endpoint', () => {
    expect(resolveChessEndpoint({ apiBase: 'http://localhost:3000', pageUrl: 'http://localhost:5173/games' })).toBe('ws://localhost:3000/colyseus');
    expect(resolveChessEndpoint({ configured: 'ws://localhost:2567', apiBase: 'http://localhost:3000', pageUrl: 'http://localhost:5173/games' })).toBe('ws://localhost:2567');
  });
});
