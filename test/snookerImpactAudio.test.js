import { resolveSnookerImpactAudio } from '../webapp/src/pages/Games/snookerImpactAudio.js';

describe('Snooker Royal impact audio', () => {
  it('does not allocate an audio voice for silence or invalid impulses', () => {
    expect(resolveSnookerImpactAudio({ impulse: 0 })).toEqual({ gain: 0, playbackRate: 1 });
    expect(resolveSnookerImpactAudio({ impulse: Number.NaN })).toEqual({ gain: 0, playbackRate: 1 });
  });

  it('makes stronger impacts louder without exceeding safe output bounds', () => {
    const soft = resolveSnookerImpactAudio({ impulse: 0.01, referenceImpulse: 0.1, shotPower: 0.5 });
    const hard = resolveSnookerImpactAudio({ impulse: 1, referenceImpulse: 0.1, shotPower: 1 });

    expect(soft.gain).toBeGreaterThan(0);
    expect(hard.gain).toBeGreaterThan(soft.gain);
    expect(hard.gain).toBeLessThanOrEqual(1);
  });

  it('uses subtle, deterministic pitch variation for each colliding pair', () => {
    const first = resolveSnookerImpactAudio({ impulse: 0.08, pairKey: 'cue:red-1' });
    const repeat = resolveSnookerImpactAudio({ impulse: 0.08, pairKey: 'cue:red-1' });
    const other = resolveSnookerImpactAudio({ impulse: 0.08, pairKey: 'red-1:red-2' });

    expect(repeat.playbackRate).toBe(first.playbackRate);
    expect(other.playbackRate).not.toBe(first.playbackRate);
    expect(first.playbackRate).toBeGreaterThanOrEqual(0.94);
    expect(first.playbackRate).toBeLessThanOrEqual(1.04);
  });

  it('sanitizes out-of-range shot power and reference impulse values', () => {
    const result = resolveSnookerImpactAudio({
      impulse: 0.1,
      referenceImpulse: 0,
      shotPower: 99,
      pairKey: 'cue:black'
    });

    expect(result.gain).toBeGreaterThan(0);
    expect(result.gain).toBeLessThanOrEqual(1);
    expect(Number.isFinite(result.playbackRate)).toBe(true);
  });
});
