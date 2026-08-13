import { describe, expect, it } from 'vitest';
import { GameValidator } from '../src/services/gameValidator.js';
import type { MatchActionPayload, MatchState } from '../src/types/events.js';

const state = (): MatchState => ({
  matchId: 'm1',
  tick: 3,
  currentTurnUserId: 'p1',
  scores: { p1: 2, p2: 1 },
  status: 'ACTIVE',
  updatedAt: Date.now(),
});

const action = (overrides: Partial<MatchActionPayload> = {}): MatchActionPayload => ({
  matchId: 'm1',
  tick: 3,
  actionType: 'END_TURN',
  actionData: {},
  ...overrides,
});

describe('GameValidator anti-cheat checks', () => {
  it('accepts only the authoritative tick and current player', () => {
    const validator = new GameValidator();
    expect(validator.validateAction(action(), state(), 'p1').valid).toBe(true);
    expect(validator.validateAction(action({ tick: 2 }), state(), 'p1').valid).toBe(false);
    expect(validator.validateAction(action(), state(), 'p2').valid).toBe(false);
  });

  it('rejects non-finite and oversized action data', () => {
    const validator = new GameValidator();
    expect(validator.validateAction(action({ actionData: { x: Number.NaN } }), state(), 'p1').valid).toBe(false);
    expect(validator.validateAction(action({ actionData: { note: 'x'.repeat(300) } }), state(), 'p1').valid).toBe(false);
  });

  it('accepts only results matching the server score and winner', () => {
    const validator = new GameValidator();
    expect(validator.validateResult(state(), 'p1', { p1: 2, p2: 1 })).toBe(true);
    expect(validator.validateResult(state(), 'p2', { p1: 2, p2: 99 })).toBe(false);
    expect(validator.validateResult(state(), 'outsider', { p1: 2, p2: 1 })).toBe(false);
  });
});
