import type { MatchActionPayload, MatchState } from '../types/events.js';

export class GameValidator {
  validateAction(payload: MatchActionPayload, state: MatchState | undefined, actorUserId: string): { valid: boolean; reason?: string } {
    if (!state) {
      return { valid: false, reason: 'Match does not exist' };
    }

    if (state.status !== 'ACTIVE') {
      return { valid: false, reason: 'Match is not active' };
    }

    if (!Object.keys(state.scores).includes(actorUserId)) {
      return { valid: false, reason: 'Actor is not in this match' };
    }

    if (payload.tick < state.tick) {
      return { valid: false, reason: 'Stale action tick' };
    }

    // TODO: Add game-specific anti-cheat rules, cooldown windows, range checks, and deterministic simulations here.
    return { valid: true };
  }
}
