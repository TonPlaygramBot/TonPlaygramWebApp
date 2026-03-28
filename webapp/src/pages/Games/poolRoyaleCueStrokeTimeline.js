import * as THREE from 'three'

export const sampleCueStrokeTimeline = ({
  elapsed = 0,
  pullbackDuration = 0,
  strikeDuration = 120,
  holdDuration = 50,
  animationStyle = 'classic'
} = {}) => {
  const pullback = Math.max(0, pullbackDuration ?? 0)
  const release = Math.max(0, strikeDuration ?? 120)
  const hold = Math.max(0, holdDuration ?? 50)
  const safeElapsed = Math.max(0, elapsed)

  const pullEnd = pullback
  const releaseEnd = pullEnd + release
  const holdEnd = releaseEnd + hold

  if (safeElapsed <= pullEnd && pullback > 0) {
    return { phase: 'pullback', t: THREE.MathUtils.clamp(safeElapsed / Math.max(pullback, 1e-6), 0, 1), hitArmed: false, done: false }
  }
  if (safeElapsed <= releaseEnd && release > 0) {
    const releaseElapsed = safeElapsed - pullEnd
    const baseT = THREE.MathUtils.clamp(releaseElapsed / Math.max(release, 1e-6), 0, 1)
    const styleT = (() => {
      switch (animationStyle) {
        case 'linear':
          return baseT
        case 'snap':
          return THREE.MathUtils.smoothstep(baseT, 0, 1)
        case 'spring': {
          // Use a critically-damped spring approximation so release motion
          // stays monotonic (never snaps backward toward pullback).
          const spring = 1 - Math.exp(-7.4 * baseT) * (1 + 7.4 * baseT)
          return THREE.MathUtils.clamp(spring, 0, 1)
        }
        case 'whip':
          return Math.pow(baseT, 0.72)
        case 'classic':
        default:
          return 1 - Math.pow(1 - baseT, 3)
      }
    })()
    return {
      phase: 'release',
      t: styleT,
      // Cue-ball movement starts only after the cue returns to the start contact point.
      hitArmed: safeElapsed >= pullEnd + release,
      done: false
    }
  }
  if (safeElapsed <= holdEnd && hold > 0) {
    return { phase: 'hold', t: THREE.MathUtils.clamp((safeElapsed - releaseEnd) / Math.max(hold, 1e-6), 0, 1), hitArmed: true, done: false }
  }
  return { phase: 'done', t: 1, hitArmed: true, done: true }
}
