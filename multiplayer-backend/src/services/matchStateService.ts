import type { MatchActionPayload, MatchState } from '../types/events.js';

export class MatchStateService {
  private readonly states = new Map<string, MatchState>();

  createInitialState(matchId: string, playerA: string, playerB: string): MatchState {
    const state: MatchState = {
      matchId,
      tick: 0,
      currentTurnUserId: playerA,
      scores: { [playerA]: 0, [playerB]: 0 },
      status: 'ACTIVE',
      updatedAt: Date.now(),
    };
    this.states.set(matchId, state);
    return state;
  }

  getState(matchId: string): MatchState | undefined {
    return this.states.get(matchId);
  }

  applyValidatedAction(action: MatchActionPayload, actorUserId: string): MatchState {
    const state = this.states.get(action.matchId);
    if (!state) {
      throw new Error('Match state not found');
    }

    if (state.currentTurnUserId !== actorUserId) {
      throw new Error('Not your turn');
    }

    state.tick += 1;
    if (action.actionType === 'ATTACK') {
      state.scores[actorUserId] = (state.scores[actorUserId] ?? 0) + 1;
    }

    const userIds = Object.keys(state.scores);
    state.currentTurnUserId = userIds.find((id) => id !== actorUserId) ?? actorUserId;
    state.updatedAt = Date.now();

    return state;
  }

  endMatch(matchId: string): MatchState | undefined {
    const state = this.states.get(matchId);
    if (!state) {
      return undefined;
    }
    state.status = 'ENDED';
    state.updatedAt = Date.now();
    return state;
  }
}
