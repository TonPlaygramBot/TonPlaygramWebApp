import * as THREE from 'three'

export const resolveCueContactPush = ({
  cueTipGap = 0,
  ballRadius = 0,
  contactGap = 0,
  minPush = 0
} = {}) => {
  const safeCueTipGap = Number.isFinite(cueTipGap) ? Math.max(0, cueTipGap) : 0
  const safeBallRadius = Number.isFinite(ballRadius) ? Math.max(0, ballRadius) : 0
  const safeContactGap = Number.isFinite(contactGap) ? Math.max(0, contactGap) : 0
  const safeMinPush = Number.isFinite(minPush) ? Math.max(0, minPush) : 0
  const physicalContactPush = safeCueTipGap - (safeBallRadius + safeContactGap)
  return Math.max(safeMinPush, physicalContactPush)
}

export const sampleCueStrokeTimeline = ({
  elapsed = 0,
  pullbackDuration = 0,
  strikeDuration = 120,
  holdDuration = 50,
  recoverDuration = 0,
  animationStyle = 'classic',
  strikeWindowRatio = 0.22,
  hitArmRatio = 0.82
} = {}) => {
  const pullback = Math.max(0, pullbackDuration ?? 0)
  const release = Math.max(0, strikeDuration ?? 120)
  const hold = Math.max(0, holdDuration ?? 50)
  const recover = Math.max(0, recoverDuration ?? 0)
  const safeElapsed = Math.max(0, elapsed)

  const pullEnd = pullback
  const releaseEnd = pullEnd + release
  const holdEnd = releaseEnd + hold
  const recoverEnd = holdEnd + recover

  if (safeElapsed <= pullEnd && pullback > 0) {
    return { phase: 'pullback', t: THREE.MathUtils.clamp(safeElapsed / Math.max(pullback, 1e-6), 0, 1), hitArmed: false, done: false }
  }
  if (safeElapsed <= releaseEnd && release > 0) {
    const releaseElapsed = safeElapsed - pullEnd
    const baseT = THREE.MathUtils.clamp(releaseElapsed / Math.max(release, 1e-6), 0, 1)
    const strikeShare = THREE.MathUtils.clamp(strikeWindowRatio, 0.05, 0.45)
    const strikeStartT = 1 - strikeShare
    const hitT = THREE.MathUtils.clamp(hitArmRatio, strikeStartT, 0.98)
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
    if (baseT < strikeStartT) {
      const releaseT = THREE.MathUtils.clamp(baseT / Math.max(strikeStartT, 1e-6), 0, 1)
      const easedReleaseT = 1 - Math.pow(1 - releaseT, 2)
      return {
        phase: 'release',
        t: easedReleaseT,
        hitArmed: false,
        done: false
      }
    }
    const strikeT = THREE.MathUtils.clamp((baseT - strikeStartT) / Math.max(strikeShare, 1e-6), 0, 1)
    return {
      phase: 'strike',
      t: Math.max(styleT, strikeT),
      hitArmed: baseT >= hitT,
      done: false
    }
  }
  if (safeElapsed <= holdEnd && hold > 0) {
    return { phase: 'hold', t: THREE.MathUtils.clamp((safeElapsed - releaseEnd) / Math.max(hold, 1e-6), 0, 1), hitArmed: true, done: false }
  }
  if (safeElapsed <= recoverEnd && recover > 0) {
    return { phase: 'recover', t: THREE.MathUtils.clamp((safeElapsed - holdEnd) / Math.max(recover, 1e-6), 0, 1), hitArmed: true, done: false }
  }
  return { phase: 'done', t: 1, hitArmed: true, done: true }
}
