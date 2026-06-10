import fs from 'node:fs';

const source = fs.readFileSync('webapp/src/pages/Games/PoolRoyale.jsx', 'utf8');

describe('Pool Royale live cue contact stroke wiring', () => {
  it('uses a SnookerRoyalProvided-style cue-ball contact gap for the strike target', () => {
    expect(source).toContain('const CUE_IDLE_GAP = BALL_R * (0.012 / 0.0525)');
    expect(source).toContain('const CUE_CONTACT_GAP = BALL_R * (0.0012 / 0.0525)');
    expect(source).toContain('const CUE_SNOOKER_PROVIDED_PULL_RANGE = BALL_R * (0.42 / 0.0525)');
    expect(source).toContain('const impactPos = buildCuePositionFromSnookerGap(CUE_CONTACT_GAP)');
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

  it('arms impact at the same normalized stroke timing as SnookerRoyalProvided', () => {
    expect(source).toContain('impactThreshold: CUE_SNOOKER_PROVIDED_IMPACT_THRESHOLD');
    expect(source).toContain('strikeImpactThreshold: strokeProfile.impactThreshold ?? CUE_SNOOKER_PROVIDED_IMPACT_THRESHOLD');
  });

  it('keeps the shot resolver waiting until the cue visually applies impact', () => {
    expect(source).toContain('const waitingForCueImpact = Boolean(');
    expect(source).toContain('!cueStrokeStateRef.current.shotApplied');
    expect(source).toContain('if (!any && !waitingForCueImpact)');
    expect(source).toContain('shotStartedAt = getNow();');
  });
});
