import fs from 'node:fs';

const source = fs.readFileSync('webapp/src/pages/Games/PoolRoyale.jsx', 'utf8');

describe('Pool Royale live cue contact stroke wiring', () => {
  it('uses a SnookerRoyalProvided-style cue-ball contact gap for the strike target', () => {
    expect(source).toContain('const CUE_CONTACT_GAP = BALL_R * 0.045');
    expect(source).toContain('const CUE_CONTACT_DISTANCE = BALL_R + CUE_CONTACT_GAP');
    expect(source).toContain('const CUE_CONTACT_ADVANCE = Math.max(0, CUE_TIP_GAP - CUE_CONTACT_DISTANCE)');
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
    expect(source).toContain('impactThreshold: 0.88');
    expect(source).toContain('strikeImpactThreshold: strokeProfile.impactThreshold ?? 0.88');
  });
});
