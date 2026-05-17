import { resolveCueContactPush, sampleCueStrokeTimeline } from '../webapp/src/pages/Games/poolRoyaleCueStrokeTimeline.js';

describe('Pool Royale cue stroke timeline', () => {
  const options = {
    pullbackDuration: 200,
    strikeDuration: 100,
    holdDuration: 80
  };

  it('starts in pullback phase', () => {
    const sample = sampleCueStrokeTimeline({ elapsed: 40, ...options });
    expect(sample.phase).toBe('pullback');
    expect(sample.t).toBeCloseTo(0.2, 2);
  });

  it('arms impact during the dedicated strike window before hold begins', () => {
    const preStrike = sampleCueStrokeTimeline({ elapsed: 277, ...options });
    const strikeStart = sampleCueStrokeTimeline({ elapsed: 278, ...options });
    const armedStrike = sampleCueStrokeTimeline({ elapsed: 282, ...options });
    expect(preStrike.phase).toBe('release');
    expect(preStrike.hitArmed).toBe(false);
    expect(strikeStart.phase).toBe('strike');
    expect(strikeStart.hitArmed).toBe(false);
    expect(armedStrike.phase).toBe('strike');
    expect(armedStrike.hitArmed).toBe(true);
  });

  it('keeps spring release monotonic so cue does not snap backward mid-push', () => {
    const early = sampleCueStrokeTimeline({ elapsed: 230, ...options, animationStyle: 'spring' });
    const middle = sampleCueStrokeTimeline({ elapsed: 260, ...options, animationStyle: 'spring' });
    const late = sampleCueStrokeTimeline({ elapsed: 295, ...options, animationStyle: 'spring' });
    expect(early.phase).toBe('release');
    expect(middle.phase).toBe('release');
    expect(late.phase).toBe('strike');
    expect(early.t).toBeLessThanOrEqual(middle.t + 1e-9);
    expect(middle.t).toBeLessThanOrEqual(late.t + 1e-9);
  });
  it('snaps to done once hold finishes (no recover phase)', () => {
    const holding = sampleCueStrokeTimeline({ elapsed: 379, ...options });
    const done = sampleCueStrokeTimeline({ elapsed: 381, ...options });
    expect(holding.phase).toBe('hold');
    expect(holding.done).toBe(false);
    expect(done.phase).toBe('done');
    expect(done.done).toBe(true);
  });

  it('computes enough forward push for the cue tip to physically reach the cue ball', () => {
    const ballRadius = 10;
    const contactGap = 0.3;
    const cueTipGap = 16.6;
    const push = resolveCueContactPush({
      cueTipGap,
      ballRadius,
      contactGap,
      minPush: 2.4
    });
    expect(push).toBeCloseTo(6.3, 5);
    expect(cueTipGap - push).toBeCloseTo(ballRadius + contactGap, 5);
  });
});
