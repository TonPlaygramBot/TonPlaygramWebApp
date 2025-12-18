import { describe, expect, test } from '@jest/globals';
import { PoolRoyaleRules } from '../src/rules/PoolRoyaleRules';
import type { FrameState, ShotEvent } from '../src/types';

type HudSnapshot = { next: string; phase: string; scores: { A: number; B: number } };

type UkMeta = {
  variant: 'uk';
  state: {
    assignments: { A: 'blue' | 'red' | null; B: 'blue' | 'red' | null };
    isOpenTable: boolean;
    mustPlayFromBaulk: boolean;
    ballsOnTable: { blue: number[]; red: number[]; black8: boolean; cueInPocket: boolean };
  };
  totals: { blue: number; red: number };
  hud: HudSnapshot;
};

type AmericanMeta = {
  variant: 'american';
  state: {
    ballInHand: boolean;
    ballsOnTable: number[];
    currentPlayer: 'A' | 'B';
    scores: { A: number; B: number };
  };
  hud: HudSnapshot;
  breakInProgress?: boolean;
};

type NineMeta = {
  variant: '9ball';
  state: { ballInHand: boolean; ballsOnTable: number[] };
  hud: HudSnapshot;
  breakInProgress?: boolean;
};

function getMeta<T>(frame: FrameState) {
  return frame.meta as T;
}

describe('PoolRoyaleRules', () => {
  test('serializes UK state across fouls and updates HUD', () => {
    const rules = new PoolRoyaleRules('uk');
    const initial = rules.getInitialFrame('Alice', 'Bob');

    const firstEvents: ShotEvent[] = [
      { type: 'HIT', firstContact: 'YELLOW', ballId: 'yellow-1' },
      { type: 'POTTED', ball: 'YELLOW', pocket: 'TR' }
    ];
    const afterPot = rules.applyShot(initial, firstEvents);
    const ukMeta = getMeta<UkMeta>(afterPot);

    expect(ukMeta.variant).toBe('uk');
    expect(ukMeta.state.assignments).toEqual({ A: 'blue', B: 'red' });
    expect(ukMeta.state.isOpenTable).toBe(false);
    expect(afterPot.players.A.score).toBe(1);
    expect(afterPot.ballOn).toEqual(['YELLOW']);
    expect(ukMeta.hud.next).toBe('yellow');

    const foulEvents: ShotEvent[] = [
      { type: 'HIT', firstContact: 'YELLOW', ballId: 'yellow-2' },
      { type: 'POTTED', ball: 'cue', pocket: 'BL', ballId: 'cue' }
    ];
    const afterFoul = rules.applyShot(afterPot, foulEvents, { cueBallPotted: true });
    const foulMeta = getMeta<UkMeta>(afterFoul);

    expect(afterFoul.foul?.reason).toBe('scratch');
    expect(afterFoul.activePlayer).toBe('B');
    expect(afterFoul.ballOn).toEqual(['RED']);
    expect(foulMeta.state.mustPlayFromBaulk).toBe(true);
    expect(foulMeta.hud.phase).toBe('groups');
  });

  test('keeps UK table open when both colours are made on the break', () => {
    const rules = new PoolRoyaleRules('uk');
    const frame = rules.getInitialFrame('Alice', 'Bob');

    const mixedPot: ShotEvent[] = [
      { type: 'HIT', firstContact: 'YELLOW', ballId: 'yellow-break' },
      { type: 'POTTED', ball: 'YELLOW', pocket: 'TR' },
      { type: 'POTTED', ball: 'RED', pocket: 'TL' }
    ];

    const result = rules.applyShot(frame, mixedPot);
    const ukMeta = getMeta<UkMeta>(result);

    expect(ukMeta.state.isOpenTable).toBe(true);
    expect(ukMeta.state.assignments).toEqual({ A: null, B: null });
    expect(result.activePlayer).toBe('B');
    expect(result.ballOn).toEqual(['RED', 'YELLOW']);
    expect(ukMeta.hud.next).toBe('red / yellow');
  });

  test('american scratch grants ball in hand and transitions off the break', () => {
    const rules = new PoolRoyaleRules('american');
    const initial = rules.getInitialFrame('Sam', 'Riley');
    const initialMeta = getMeta<AmericanMeta>(initial);

    expect(initialMeta.breakInProgress).toBe(true);
    expect(initialMeta.state.ballInHand).toBe(true);
    expect(initialMeta.hud.next).toBe('ball 1');

    const scratchEvents: ShotEvent[] = [{ type: 'HIT', firstContact: 1, ballId: 1 }];
    const afterScratch = rules.applyShot(initial, scratchEvents, { cueBallPotted: true, placedFromHand: true });
    const scratchMeta = getMeta<AmericanMeta>(afterScratch);

    expect(afterScratch.foul?.reason).toBe('scratch');
    expect(afterScratch.activePlayer).toBe('B');
    expect(scratchMeta.state.ballInHand).toBe(true);
    expect(scratchMeta.breakInProgress).toBe(false);
    expect(afterScratch.ballOn).toEqual(['BALL_1']);
    expect(afterScratch.players.B.score).toBe(1);

    const recoveryEvents: ShotEvent[] = [
      { type: 'HIT', firstContact: 1, ballId: 1 },
      { type: 'POTTED', ball: 1, pocket: 'BR' }
    ];
    const recovered = rules.applyShot(afterScratch, recoveryEvents, { placedFromHand: true });
    const recoveryMeta = getMeta<AmericanMeta>(recovered);

    expect(recovered.foul).toBeUndefined();
    expect(recovered.activePlayer).toBe('B');
    expect(recovered.ballOn).toEqual(['BALL_2']);
    expect(recoveryMeta.state.ballInHand).toBe(false);
    expect(recoveryMeta.hud.next).toBe('ball 2');
  });

  test('9-ball requires the lowest object ball on contact and updates HUD', () => {
    const rules = new PoolRoyaleRules('9ball');
    const initial = rules.getInitialFrame('Jo', 'Kai');
    const foulEvents: ShotEvent[] = [
      { type: 'HIT', firstContact: 2, ballId: 2 },
      { type: 'POTTED', ball: 2, pocket: 'TM' }
    ];

    const afterFoul = rules.applyShot(initial, foulEvents);
    const nineMeta = getMeta<NineMeta>(afterFoul);

    expect(afterFoul.foul?.reason).toBe('wrong first contact');
    expect(afterFoul.activePlayer).toBe('B');
    expect(afterFoul.ballOn).toEqual(['BALL_1']);
    expect(nineMeta.state.ballInHand).toBe(true);
    expect(nineMeta.hud.phase).toBe('run');
    expect(nineMeta.hud.next).toBe('ball 1');
  });
});
