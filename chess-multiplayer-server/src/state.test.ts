import { describe, expect, it } from 'vitest';
import { ChessLobbyState, LobbyPlayer } from './state.js';

describe('ChessLobbyState', () => {
  it('enforces battle royale defaults', () => {
    const state = new ChessLobbyState();
    expect(state.minPlayers).toBe(4);
    expect(state.maxPlayers).toBe(8);
    expect(state.phase).toBe('waiting');
  });

  it('stores authoritative readiness per session', () => {
    const state = new ChessLobbyState();
    const player = new LobbyPlayer();
    player.accountId = 'TPC-1';
    player.ready = true;
    state.players.set('session-1', player);
    expect(state.players.get('session-1')?.ready).toBe(true);
  });
});
