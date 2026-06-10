import fs from 'node:fs';

const source = fs.readFileSync('webapp/src/pages/Games/PoolRoyale.jsx', 'utf8');

describe('Pool Royale live cue contact stroke wiring', () => {
  it('uses the same cue gap and pull ratios as SnookerRoyalProvided CFG', () => {
    expect(source).toContain('const SNOOKER_PROVIDED_IDLE_GAP = BALL_R * 0.31022900763358785');
    expect(source).toContain('const SNOOKER_PROVIDED_CONTACT_GAP = BALL_R * 0.03102290076335878');
    expect(source).toContain('const SNOOKER_PROVIDED_PULL_RANGE = BALL_R * 10.858015267175574');
    expect(source).toContain('const CUE_TIP_GAP = BALL_R + SNOOKER_PROVIDED_IDLE_GAP');
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

  it('arms impact at the same normalized stroke timing as SnookerRoyalProvided', () => {
    expect(source).toContain('const SNOOKER_PROVIDED_STRIKE_MS = 120');
    expect(source).toContain('const SNOOKER_PROVIDED_HOLD_MS = 50');
    expect(source).toContain('const SNOOKER_PROVIDED_IMPACT_THRESHOLD = 0.88');
    expect(source).toContain('if (!stroke.shotApplied && strikeProgress > impactThreshold)');
    expect(source).toContain('strikeImpactThreshold: strokeProfile.impactThreshold ?? SNOOKER_PROVIDED_IMPACT_THRESHOLD');
  });

  it('uses SnookerRoyalProvided pull math instead of Pool visual multipliers for the shot', () => {
    expect(source).toContain('const pullRatio = easeOutCubic(p)');
    expect(source).toContain('pullDistance: SNOOKER_PROVIDED_PULL_RANGE * pullRatio');
    expect(source).toContain('const visualPull = startPull');
    expect(source).not.toContain('const visualPull = applyVisualPullCompensation(startPull, dir);');
  });
});
