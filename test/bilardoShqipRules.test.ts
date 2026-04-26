import { describe, expect, test } from '@jest/globals';
import { BilardoShqipRules } from '../src/rules/BilardoShqipRules';

describe('BilardoShqipRules', () => {
  test('awards points by numbered balls and keeps turn on legal pot', () => {
    const rules = new BilardoShqipRules(61);

    const result = rules.resolveShot({
      firstContact: 1,
      potted: [1, 2],
      cueBallPotted: false
    });

    expect(result.foul).toBe(false);
    expect(result.scored).toBe(3);
    expect(result.scores.A).toBe(3);
    expect(result.keepTurn).toBe(true);
    expect(result.nextPlayer).toBe('A');
  });

  test('flags foul on wrong first contact', () => {
    const rules = new BilardoShqipRules(61);

    const result = rules.resolveShot({
      firstContact: 2,
      potted: [],
      cueBallPotted: false
    });

    expect(result.foul).toBe(true);
    expect(result.reason).toContain('wrong first contact');
    expect(result.cueBallInHand).toBe(true);
    expect(result.nextPlayer).toBe('B');
  });

  test('reracks when table clears before 61', () => {
    const rules = new BilardoShqipRules(200);

    const result = rules.resolveShot({
      firstContact: 1,
      potted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      cueBallPotted: false
    });

    expect(result.reracked).toBe(true);
    expect(result.ballsRemaining).toBe(15);
    expect(result.nextRequiredBall).toBe(1);
    expect(result.winner).toBeNull();
  });

  test('declares winner once active player reaches race target', () => {
    const rules = new BilardoShqipRules(61);
    const first = rules.resolveShot({ firstContact: 1, potted: [1, 2, 3, 4, 5, 6, 7, 8], cueBallPotted: false });
    expect(first.scores.A).toBe(36);

    const second = rules.resolveShot({ firstContact: 9, potted: [9, 10, 11], cueBallPotted: false });
    expect(second.scores.A).toBe(66);
    expect(second.winner).toBe('A');
  });
});
