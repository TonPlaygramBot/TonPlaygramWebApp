import fs from 'node:fs';

const source = fs.readFileSync('webapp/src/pages/Games/PoolRoyale.jsx', 'utf8');

describe('Pool Royale live cue contact stroke wiring', () => {
  it('uses the same idle/contact gap ratios as SnookerRoyalProvided for the strike target', () => {
    expect(source).toContain('const SNOOKER_PROVIDED_IDLE_GAP_RATIO = 0.62244');
    expect(source).toContain('const SNOOKER_PROVIDED_CONTACT_GAP_RATIO = 0.06224');
    expect(source).toContain('const CUE_TIP_GAP = BALL_R + CUE_TIP_CLEARANCE');
    expect(source).toContain('const CUE_CONTACT_DISTANCE = BALL_R + CUE_CONTACT_GAP');
    expect(source).toContain('const impactPos = buildCuePosition(-contactAdvance)');
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

  it('uses SnookerRoyalProvided pull, timing, and frozen contact stroke math', () => {
    expect(source).toContain('const SNOOKER_PROVIDED_PULL_RANGE_RATIO = 21.78538');
    expect(source).toContain('const SNOOKER_PROVIDED_STRIKE_TIME_MS = 120');
    expect(source).toContain('const SNOOKER_PROVIDED_HOLD_TIME_MS = 50');
    expect(source).toContain('const SNOOKER_PROVIDED_IMPACT_NORM = 0.88');
    expect(source).toContain('pullRatio: easeOutCubic(p)');
    expect(source).toContain('const strikeMotionNorm = stroke.shotApplied ? impactThreshold : strikeProgress');
    expect(source).toContain('strikeImpactThreshold: strokeProfile.impactThreshold ?? SNOOKER_PROVIDED_IMPACT_NORM');
  });
});
