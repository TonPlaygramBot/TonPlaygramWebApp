import { sampleCueStrokeTimeline } from '../webapp/src/pages/Games/poolRoyaleCueStrokeTimeline.js';

describe('Pool Royale cue stroke timeline', () => {
  const options = {
    pullbackDuration: 200,
    strikeDuration: 100,
    holdDuration: 80,
    recoverDuration: 120
  };

  it('starts in pullback phase', () => {
    const sample = sampleCueStrokeTimeline({ elapsed: 40, ...options });
    expect(sample.phase).toBe('pullback');
    expect(sample.t).toBeCloseTo(0.2, 2);
  });

  it('arms impact exactly when release reaches the start contact position', () => {
    const preHit = sampleCueStrokeTimeline({ elapsed: 299, ...options });
    const atHit = sampleCueStrokeTimeline({ elapsed: 300, ...options });
    expect(preHit.phase).toBe('release');
    expect(preHit.hitArmed).toBe(false);
    expect(atHit.phase).toBe('release');
    expect(atHit.hitArmed).toBe(true);
  });

  it('keeps spring release monotonic so cue does not snap backward mid-push', () => {
    const early = sampleCueStrokeTimeline({ elapsed: 230, ...options, animationStyle: 'spring' });
    const middle = sampleCueStrokeTimeline({ elapsed: 260, ...options, animationStyle: 'spring' });
    const late = sampleCueStrokeTimeline({ elapsed: 295, ...options, animationStyle: 'spring' });
    expect(early.phase).toBe('release');
    expect(middle.phase).toBe('release');
    expect(late.phase).toBe('release');
    expect(early.t).toBeLessThanOrEqual(middle.t + 1e-9);
    expect(middle.t).toBeLessThanOrEqual(late.t + 1e-9);
  });
  it('transitions to recover after hold and finishes at done', () => {
    const holding = sampleCueStrokeTimeline({ elapsed: 379, ...options });
    const recovering = sampleCueStrokeTimeline({ elapsed: 410, ...options });
    const done = sampleCueStrokeTimeline({ elapsed: 501, ...options });
    expect(holding.phase).toBe('hold');
    expect(holding.done).toBe(false);
    expect(recovering.phase).toBe('recover');
    expect(recovering.done).toBe(false);
    expect(done.phase).toBe('done');
    expect(done.done).toBe(true);
  });
});
