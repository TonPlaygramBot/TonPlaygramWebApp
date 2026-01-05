import { PoolRoyaleRules } from '../src/rules/PoolRoyaleRules';
import { ShotContext, ShotEvent } from '../src/types';

describe('PoolRoyaleRules', () => {
  test('UK variant preserves assignments through serialization and updates HUD', () => {
    const rules = new PoolRoyaleRules('uk');
    const initialFrame = rules.getInitialFrame('Player A', 'Player B');
    const initialMeta = initialFrame.meta as any;

    expect(initialMeta?.variant).toBe('uk');
    expect(initialMeta?.hud?.next).toBe('open table');
    expect(initialMeta?.state?.isOpenTable).toBe(true);
    expect(initialMeta?.breakInProgress).toBe(true);

    const assignEvents: ShotEvent[] = [
      { type: 'HIT', firstContact: 'red', ballId: 'RED' },
      { type: 'POTTED', ball: 'RED', pocket: 'TM', ballId: 'RED' }
    ];
    const assigned = rules.applyShot(initialFrame, assignEvents, {
      placedFromHand: true,
      contactMade: true,
      cushionAfterContact: true
    });
    const assignedMeta = assigned.meta as any;

    expect(assignedMeta?.state?.assignments?.A).toBe('red');
    expect(assignedMeta?.state?.assignments?.B).toBe('blue');
    expect(assignedMeta?.state?.isOpenTable).toBe(false);
    expect(assigned.ballOn).toEqual(['RED']);
    expect(assignedMeta?.hud?.next).toBe('red');
    expect(assignedMeta?.hud?.phase).toBe('groups');
    expect(assignedMeta?.breakInProgress).toBe(false);
    expect(assigned.currentBreak).toBe(1);

    const foulEvents: ShotEvent[] = [
      { type: 'HIT', firstContact: 'black', ballId: 'BLACK' },
      { type: 'POTTED', ball: 'cue', pocket: 'BR', ballId: 'cue' }
    ];
    const foulContext: ShotContext = { cueBallPotted: true, contactMade: true };
    const foulState = new PoolRoyaleRules('uk').applyShot(assigned, foulEvents, foulContext);
    const foulMeta = foulState.meta as any;

    expect(foulState.foul?.reason).toBe('scratch');
    expect(foulMeta?.state?.mustPlayFromBaulk).toBe(true);
    expect(foulState.activePlayer).toBe('B');
    expect(foulMeta?.hud?.phase).toBe('groups');
    expect(foulState.ballOn).toContain('YELLOW');
  });

  test('American variant handles break transition, fouls, and ball-in-hand', () => {
    const rules = new PoolRoyaleRules('american');
    const initialFrame = rules.getInitialFrame('Breaker', 'Opponent');
    const initialMeta = initialFrame.meta as any;

    expect(initialMeta?.variant).toBe('american');
    expect(initialMeta?.breakInProgress).toBe(true);
    expect(initialMeta?.state?.ballInHand).toBe(true);
    expect(initialMeta?.hud?.next).toBe('ball 1');

    const breakEvents: ShotEvent[] = [
      { type: 'HIT', firstContact: 1, ballId: 1 },
      { type: 'POTTED', ball: 1, pocket: 'BL', ballId: 1 },
      { type: 'POTTED', ball: 2, pocket: 'BR', ballId: 2 }
    ];
    const cleared = rules.applyShot(initialFrame, breakEvents, {
      placedFromHand: true,
      contactMade: true,
      cushionAfterContact: true
    });
    const clearedMeta = cleared.meta as any;

    expect(clearedMeta?.breakInProgress).toBe(false);
    expect(clearedMeta?.state?.ballInHand).toBe(false);
    expect(cleared.ballOn).toEqual(['BALL_3']);
    expect(clearedMeta?.hud?.next).toBe('ball 3');
    expect(cleared.players.A.score).toBe(3);
    expect(cleared.currentBreak).toBe(3);

    const scratchEvents: ShotEvent[] = [
      { type: 'HIT', firstContact: 3, ballId: 3 },
      { type: 'POTTED', ball: 0, pocket: 'TR', ballId: 'cue' }
    ];
    const scratchContext: ShotContext = { cueBallPotted: true, contactMade: true };
    const scratch = rules.applyShot(cleared, scratchEvents, scratchContext);
    const scratchMeta = scratch.meta as any;

    expect(scratch.foul?.reason).toBe('scratch');
    expect(scratchMeta?.state?.ballInHand).toBe(true);
    expect(scratch.activePlayer).toBe('B');
    expect(scratch.ballOn).toEqual(['BALL_3']);
    expect(scratchMeta?.hud?.phase).toBe('rotation');
    expect(scratch.currentBreak).toBe(0);
  });

  test('Nine-ball enforces lowest-ball contact and updates HUD after recovery', () => {
    const rules = new PoolRoyaleRules('9ball');
    const initialFrame = rules.getInitialFrame('Challenger', 'Rival');
    const initialMeta = initialFrame.meta as any;

    expect(initialMeta?.variant).toBe('9ball');
    expect(initialMeta?.breakInProgress).toBe(true);
    expect(initialMeta?.state?.ballInHand).toBe(true);
    expect(initialFrame.ballOn).toEqual(['BALL_1']);
    expect(initialMeta?.hud?.next).toBe('ball 1');

    const foulEvents: ShotEvent[] = [{ type: 'HIT', firstContact: 2, ballId: 2 }];
    const foulState = rules.applyShot(initialFrame, foulEvents, { contactMade: true });
    const foulMeta = foulState.meta as any;

    expect(foulState.foul?.reason).toBe('wrong first contact');
    expect(foulMeta?.state?.ballInHand).toBe(true);
    expect(foulState.activePlayer).toBe('B');
    expect(foulState.ballOn).toEqual(['BALL_1']);

    const recoveryEvents: ShotEvent[] = [
      { type: 'HIT', firstContact: 1, ballId: 1 },
      { type: 'POTTED', ball: 1, pocket: 'TM', ballId: 1 }
    ];
    const recoveryContext: ShotContext = { placedFromHand: true, contactMade: true };
    const recoveryState = rules.applyShot(foulState, recoveryEvents, recoveryContext);
    const recoveryMeta = recoveryState.meta as any;

    expect(recoveryMeta?.breakInProgress).toBe(false);
    expect(recoveryMeta?.state?.ballInHand).toBe(false);
    expect(recoveryState.ballOn).toEqual(['BALL_2']);
    expect(recoveryMeta?.hud?.next).toBe('ball 2');
    expect(recoveryState.currentBreak).toBe(1);
  });
});
