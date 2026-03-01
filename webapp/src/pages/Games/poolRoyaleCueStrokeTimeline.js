import * as THREE from 'three';

export const sampleCueStrokeTimeline = ({
  elapsed = 0,
  pullbackDuration = 0,
  strikeDuration = 120,
  holdDuration = 50,
  recoverDuration = 130
} = {}) => {
  const pullback = Math.max(0, pullbackDuration ?? 0);
  const release = Math.max(0, strikeDuration ?? 120);
  const hold = Math.max(0, holdDuration ?? 50);
  const recover = Math.max(0, recoverDuration ?? 130);
  const safeElapsed = Math.max(0, elapsed);

  const pullEnd = pullback;
  const releaseEnd = pullEnd + release;
  const holdEnd = releaseEnd + hold;
  const recoverEnd = holdEnd + recover;

  if (safeElapsed <= pullEnd && pullback > 0) {
    return { phase: 'pullback', t: THREE.MathUtils.clamp(safeElapsed / Math.max(pullback, 1e-6), 0, 1), hitArmed: false, done: false };
  }
  if (safeElapsed <= releaseEnd && release > 0) {
    const releaseElapsed = safeElapsed - pullEnd;
    return {
      phase: 'release',
      t: THREE.MathUtils.clamp(releaseElapsed / Math.max(release, 1e-6), 0, 1),
      // Arm impact a little earlier so the forward cue-stick travel is visible
      // before the simulated hit is applied in both live-play and replay.
      hitArmed: safeElapsed >= pullEnd + release * 0.82,
      done: false
    };
  }
  if (safeElapsed <= holdEnd && hold > 0) {
    return { phase: 'hold', t: THREE.MathUtils.clamp((safeElapsed - releaseEnd) / Math.max(hold, 1e-6), 0, 1), hitArmed: true, done: false };
  }
  if (safeElapsed <= recoverEnd && recover > 0) {
    return { phase: 'recover', t: THREE.MathUtils.clamp((safeElapsed - holdEnd) / Math.max(recover, 1e-6), 0, 1), hitArmed: true, done: false };
  }
  return { phase: 'done', t: 1, hitArmed: true, done: true };
};
