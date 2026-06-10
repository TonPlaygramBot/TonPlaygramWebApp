import fs from 'node:fs';

const source = fs.readFileSync('webapp/src/pages/Games/PoolRoyale.jsx', 'utf8');

describe('Pool Royale live cue stroke mirrors SnookerRoyalProvided', () => {
  it('uses SnookerRoyalProvided gap and pull ratios for the live strike target', () => {
    expect(source).toContain('const SNOOKER_PROVIDED_IDLE_GAP = BALL_R * (0.012 / 0.0525)');
    expect(source).toContain('const SNOOKER_PROVIDED_CONTACT_GAP = BALL_R * (0.0012 / 0.0525)');
    expect(source).toContain('const SNOOKER_PROVIDED_PULL_RANGE = BALL_R * (0.42 / 0.0525)');
    expect(source).toContain('const contactPos = buildCuePositionFromGap(SNOOKER_PROVIDED_CONTACT_GAP)');
  });

  it('uses SnookerRoyalProvided strike and hold durations', () => {
    expect(source).toContain('const strikeDuration = 120');
    expect(source).toContain('const holdDuration = 50');
  });

  it('does not apply cue-ball power before the animated cue reaches impact', () => {
    const payloadIndex = source.indexOf('const shotImpactPayload = {');
    const helperIndex = source.indexOf('const applyShotImpactOnce = () => {', payloadIndex);
    const animationIndex = source.indexOf('if (ENABLE_CUE_STROKE_ANIMATION)', helperIndex);
    const prematureSection = source.slice(payloadIndex, helperIndex);

    expect(payloadIndex).toBeGreaterThan(-1);
    expect(helperIndex).toBeGreaterThan(payloadIndex);
    expect(animationIndex).toBeGreaterThan(helperIndex);
    expect(prematureSection).not.toContain('applyShotAtImpact(shotImpactPayload);');
    expect(source).toContain('onImpact: () => applyShotImpactOnce()');
  });

  it('matches SnookerRoyalProvided didHit timing and locked strikeMotionNorm behavior', () => {
    expect(source).toContain('const SNOOKER_PROVIDED_IMPACT_THRESHOLD = 0.88');
    expect(source).toContain('const strikeMotionNorm = stroke.shotApplied ? impactThreshold : strikeProgress');
    expect(source).toContain('if (!stroke.shotApplied && strikeProgress > impactThreshold)');
  });
});
