import { PoolRoyaleRules } from '../src/rules/PoolRoyaleRules';
import { poolRoyalBallInHand, poolRoyalBallsToSpot } from '../webapp/src/pages/Games/poolRoyaleShotLifecycle.js';
import { ShotContext, ShotEvent } from '../src/types';

describe('PoolRoyaleRules', () => {
  test('UK variant preserves assignments through serialization and updates HUD', () => {
    const rules = new PoolRoyaleRules('uk');
    const initialFrame = rules.getInitialFrame('Player A', 'Player B');
    const initialMeta = initialFrame.meta as any;

    expect(initialMeta?.variant).toBe('uk');
    expect(initialMeta?.hud?.next).toBe('open table');
    expect(initialMeta?.state?.isOpenTable).toBe(true);

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

    const foulEvents: ShotEvent[] = [
      { type: 'HIT', firstContact: 'black', ballId: 'BLACK' },
      { type: 'POTTED', ball: 'cue', pocket: 'BR', ballId: 'cue' }
    ];
    const foulContext: ShotContext = { cueBallPotted: true, contactMade: true };
    const foulState = new PoolRoyaleRules('uk').applyShot(assigned, foulEvents, foulContext);
    const foulMeta = foulState.meta as any;

    expect(foulState.foul?.reason).toBe('scratch');
    expect(foulMeta?.state?.mustPlayFromBaulk).toBe(false);
    expect(foulState.activePlayer).toBe('B');
    expect(foulMeta?.hud?.phase).toBe('groups');
    expect(foulState.ballOn).toContain('YELLOW');
  });

  test('Legacy american variant key is remapped to 8-ball rules', () => {
    const rules = new PoolRoyaleRules('american');
    const initialFrame = rules.getInitialFrame('Breaker', 'Opponent');
    const initialMeta = initialFrame.meta as any;

    expect(initialMeta?.variant).toBe('8ball');
    expect(initialMeta?.breakInProgress).toBe(true);
    expect(initialMeta?.state?.ballInHand).toBe(true);
    expect(initialMeta?.hud?.next).toBe('open table');
    expect(initialMeta?.hud?.phase).toBe('groups');
    expect(initialFrame.ballOn).toEqual(['SOLID', 'STRIPE']);

    const breakEvents: ShotEvent[] = [
      { type: 'HIT', firstContact: 1, ballId: 1 },
      { type: 'POTTED', ball: 1, pocket: 'BL', ballId: 1 }
    ];
    const cleared = rules.applyShot(initialFrame, breakEvents, {
      placedFromHand: true,
      contactMade: true,
      cushionAfterContact: true
    });
    const clearedMeta = cleared.meta as any;

    expect(clearedMeta?.breakInProgress).toBe(false);
    expect(clearedMeta?.state?.ballInHand).toBe(false);
    expect(cleared.ballOn).toEqual(['SOLID', 'STRIPE']);
    expect(clearedMeta?.hud?.next).toBe('solid / stripe');
    expect(clearedMeta?.hud?.phase).toBe('groups');
    expect(cleared.players.A.score).toBe(0);
    expect(cleared.activePlayer).toBe('A');

    const scratchEvents: ShotEvent[] = [
      { type: 'HIT', firstContact: 3, ballId: 3 },
      { type: 'POTTED', ball: 0, pocket: 'TR', ballId: 'cue' }
    ];
    const scratchContext: ShotContext = { cueBallPotted: true, contactMade: true };
    const scratch = rules.applyShot(cleared, scratchEvents, scratchContext);
    const scratchMeta = scratch.meta as any;

    expect(scratch.foul?.reason).toBe('scratch');
    expect(scratchMeta?.state?.ballInHand).toBe(true);
    expect(scratchMeta?.breakInProgress).toBe(false);
    expect(scratch.activePlayer).toBe('B');
    expect(scratch.ballOn).toEqual(['SOLID', 'STRIPE']);
    expect(scratchMeta?.hud?.next).toBe('solid / stripe');
    expect(scratchMeta?.hud?.phase).toBe('groups');
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

    const breakEvents: ShotEvent[] = [
      { type: 'HIT', firstContact: 1, ballId: 1 },
      { type: 'POTTED', ball: 1, pocket: 'TM', ballId: 1 }
    ];
    const postBreak = rules.applyShot(initialFrame, breakEvents, {
      contactMade: true,
      railContactCountAfterContact: 4
    });
    const postBreakMeta = postBreak.meta as any;

    expect(postBreak.foul).toBeUndefined();
    expect(postBreakMeta?.breakInProgress).toBe(false);
    expect(postBreak.activePlayer).toBe('A');
    expect(postBreak.ballOn).toEqual(['BALL_2']);

    const foulEvents: ShotEvent[] = [{ type: 'HIT', firstContact: 3, ballId: 3 }];
    const foulState = rules.applyShot(postBreak, foulEvents, { contactMade: true });
    const foulMeta = foulState.meta as any;

    expect(foulState.foul?.reason).toBe('wrong first contact');
    expect(foulMeta?.state?.ballInHand).toBe(true);
    expect(foulState.activePlayer).toBe('B');
    expect(foulState.ballOn).toEqual(['BALL_2']);

    const recoveryEvents: ShotEvent[] = [
      { type: 'HIT', firstContact: 2, ballId: 2 },
      { type: 'POTTED', ball: 2, pocket: 'TM', ballId: 2 }
    ];
    const recoveryContext: ShotContext = { placedFromHand: true, contactMade: true };
    const recoveryState = rules.applyShot(foulState, recoveryEvents, recoveryContext);
    const recoveryMeta = recoveryState.meta as any;

    expect(recoveryMeta?.breakInProgress).toBe(false);
    expect(recoveryMeta?.state?.ballInHand).toBe(false);
    expect(recoveryState.ballOn).toEqual(['BALL_3']);
    expect(recoveryMeta?.hud?.next).toBe('ball 3');
  });

  test('9-ball marks an illegal break as foul when no ball is potted and rails are insufficient', () => {
    const rules = new PoolRoyaleRules('9ball');
    const initialFrame = rules.getInitialFrame('Breaker', 'Opponent');
    const illegalBreak = rules.applyShot(
      initialFrame,
      [{ type: 'HIT', firstContact: 1, ballId: 1 }],
      { contactMade: true, railContactCountAfterContact: 1 }
    );
    expect(illegalBreak.foul?.reason).toBe('illegal break');
    expect(illegalBreak.activePlayer).toBe('B');
  });

  test('8-ball keeps its own rules and allows a legal black-ball finish', () => {
    const rules = new PoolRoyaleRules('8ball-us');
    const initial = rules.getInitialFrame('Shooter', 'Opponent');
    const initialMeta = initial.meta as any;

    expect(initialMeta?.variant).toBe('8ball');
    expect(initial.ballOn).toEqual(['SOLID', 'STRIPE']);

    // Group assignment is tested on an open table AFTER the break.
    initialMeta.state.breakInProgress = false;
    const assignSolid = rules.applyShot(
      initial,
      [
        { type: 'HIT', firstContact: 1, ballId: 1 },
        { type: 'POTTED', ball: 1, pocket: 'BL', ballId: 1 }
      ],
      { contactMade: true, cushionAfterContact: true }
    );
    const assignMeta = assignSolid.meta as any;
    expect(assignMeta?.state?.assignments?.A).toBe('SOLID');
    expect(assignSolid.ballOn).toEqual(['SOLID']);

    const clearSolids = rules.applyShot(
      assignSolid,
      [
        { type: 'HIT', firstContact: 2, ballId: 2 },
        { type: 'POTTED', ball: 2, pocket: 'BL', ballId: 2 },
        { type: 'POTTED', ball: 3, pocket: 'BM', ballId: 3 },
        { type: 'POTTED', ball: 4, pocket: 'BR', ballId: 4 },
        { type: 'POTTED', ball: 5, pocket: 'TL', ballId: 5 },
        { type: 'POTTED', ball: 6, pocket: 'TM', ballId: 6 },
        { type: 'POTTED', ball: 7, pocket: 'TR', ballId: 7 }
      ],
      { contactMade: true, cushionAfterContact: true }
    );
    expect(clearSolids.foul).toBeUndefined();
    expect(clearSolids.ballOn).toEqual(['BLACK']);

    const blackFinish = rules.applyShot(
      clearSolids,
      [
        { type: 'HIT', firstContact: 8, ballId: 8 },
        { type: 'POTTED', ball: 8, pocket: 'TM', ballId: 8 }
      ],
      { contactMade: true, cushionAfterContact: true }
    );
    expect(blackFinish.foul).toBeUndefined();
    expect(blackFinish.frameOver).toBe(true);
    expect(blackFinish.winner).toBe('A');
  });
});


test('raw game IDs survive rule resolution, nine spotting, and ball-in-hand', () => {
  const rules = new PoolRoyaleRules('9ball');
  const initial = rules.getInitialFrame('Shooter', 'Opponent');
  const result = rules.applyShot(initial, [
    { type: 'HIT', firstContact: 1, ballId: 'ball_1' },
    { type: 'POTTED', ball: 9, ballId: 'ball_9', pocket: 'TM' },
    { type: 'POTTED', ball: 'CUE', ballId: 'cue', pocket: 'TM' }
  ], { contactMade: true, cueBallPotted: true });
  expect(result.activePlayer).toBe('B');
  expect(result.frameOver).toBe(false);
  expect(poolRoyalBallInHand(result)).toBe(true);
  const balls = [{ id: 'cue', active: false }, { id: 'ball_9', active: false }, { id: 'ball_1', active: true }];
  expect(poolRoyalBallsToSpot(balls, result).map((ball: { id: string }) => ball.id)).toEqual(['ball_9']);
});

test('nine-ball HUD warns the returning player before a third consecutive foul', () => {
  const rules = new PoolRoyaleRules('9ball');
  let frame = rules.getInitialFrame('Shooter', 'Opponent');
  (frame.meta as any).state.breakInProgress = false;
  for (let i = 0; i < 2; i++) {
    frame = rules.applyShot(frame, [{ type: 'HIT', firstContact: 2, ballId: 'ball_2' }], { contactMade: true });
    frame = rules.applyShot(frame, [{ type: 'HIT', firstContact: 1, ballId: 'ball_1' }], { contactMade: true, cushionAfterContact: true });
  }
  expect(frame.activePlayer).toBe('A');
  expect((frame.meta as any).hud.next).toContain('2 fouls: next foul loses');
});
