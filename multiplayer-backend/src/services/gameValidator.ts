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

    if (payload.tick !== state.tick) {
      return { valid: false, reason: 'Action tick is stale or ahead of the server' };
    }

    if (state.currentTurnUserId !== actorUserId) {
      return { valid: false, reason: 'Not your turn' };
    }

    if (!this.isSafeActionData(payload.actionData)) {
      return { valid: false, reason: 'Action data exceeds safe limits' };
    }

    return { valid: true };
  }

  validateResult(state: MatchState | undefined, winnerUserId: string, scores: Record<string, number>) {
    if (!state || state.status !== 'ACTIVE') return false;
    const players = Object.keys(state.scores).sort();
    if (!players.includes(winnerUserId) || Object.keys(scores).sort().join('|') !== players.join('|')) return false;
    if (players.some((id) => !Number.isSafeInteger(scores[id]) || scores[id] < 0 || scores[id] !== state.scores[id])) return false;
    return players.every((id) => scores[winnerUserId] >= scores[id]);
  }

  private isSafeActionData(value: Record<string, unknown>): boolean {
    let encoded: string;
    try {
      encoded = JSON.stringify(value);
    } catch {
      return false;
    }
    if (encoded.length > 4096) return false;

    const safe = (item: unknown, depth: number): boolean => {
      if (depth > 4) return false;
      if (typeof item === 'number') return Number.isFinite(item) && Math.abs(item) <= 1_000_000;
      if (typeof item === 'string') return item.length <= 256;
      if (typeof item === 'boolean' || item === null) return true;
      if (Array.isArray(item)) return item.length <= 64 && item.every((entry) => safe(entry, depth + 1));
      if (typeof item === 'object') {
        const entries = Object.entries(item as Record<string, unknown>);
        return entries.length <= 64 && entries.every(([key, entry]) => key.length <= 64 && safe(entry, depth + 1));
      }
      return false;
    };
    return safe(value, 0);
  }
}
