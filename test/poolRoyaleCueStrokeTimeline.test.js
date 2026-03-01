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

  it('arms impact near end of release', () => {
    const preHit = sampleCueStrokeTimeline({ elapsed: 280, ...options });
    const postHit = sampleCueStrokeTimeline({ elapsed: 292, ...options });
    expect(preHit.phase).toBe('release');
    expect(preHit.hitArmed).toBe(false);
    expect(postHit.phase).toBe('release');
    expect(postHit.hitArmed).toBe(true);
  });


  it('arms impact before the very end of release so forward push is visible', () => {
    const armed = sampleCueStrokeTimeline({ elapsed: 283, ...options });
    expect(armed.phase).toBe('release');
    expect(armed.hitArmed).toBe(true);
  });

  it('enters recover then done', () => {
    const recovering = sampleCueStrokeTimeline({ elapsed: 430, ...options });
    const done = sampleCueStrokeTimeline({ elapsed: 510, ...options });
    expect(recovering.phase).toBe('recover');
    expect(recovering.done).toBe(false);
    expect(done.phase).toBe('done');
    expect(done.done).toBe(true);
  });
});
