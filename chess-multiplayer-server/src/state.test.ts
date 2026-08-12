import { describe, expect, it } from 'vitest';
import { ChessLobbyState, LobbyPlayer } from './state.js';
import { canStartChessMatch, ChessBattleRoyaleRoom } from './ChessLobbyRoom.js';

describe('ChessLobbyState', () => {
  it('enforces exactly two chess seats', () => {
    const state = new ChessLobbyState();
    expect(state.minPlayers).toBe(2);
    expect(state.maxPlayers).toBe(2);
    expect(new ChessBattleRoyaleRoom().maxClients).toBe(2);
    expect(state.phase).toBe('waiting');
  });

  it('starts only when exactly two connected players are ready', () => {
    const first = new LobbyPlayer();
    const second = new LobbyPlayer();
    first.ready = true;
    second.ready = true;
    expect(canStartChessMatch([first])).toBe(false);
    expect(canStartChessMatch([first, second])).toBe(true);
    second.connected = false;
    expect(canStartChessMatch([first, second])).toBe(false);
    second.connected = true;
    expect(canStartChessMatch([first, second, new LobbyPlayer()])).toBe(false);
  });

  it('stores authoritative readiness per session', () => {
    const state = new ChessLobbyState();
    const player = new LobbyPlayer();
    player.accountId = 'TPG-1';
    player.ready = true;
    state.players.set('session-1', player);
    expect(state.players.get('session-1')?.ready).toBe(true);
  });
});
