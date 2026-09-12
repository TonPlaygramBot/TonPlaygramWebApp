import * as THREE from 'three';

const unit = value => THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
const easeOut = t => 1 - (1 - unit(t)) ** 3;

// Ratios and timing from the supplied human/cue demo, scaled by the live ball.
export const POOL_ROYAL_STROKE = Object.freeze({ strikeDuration: 160, holdDuration: 120, hitArmRatio: 0.88 });
export const referenceCuePull = (power, radius) => radius * (0.42 / 0.045) * easeOut(power);
export const referenceCueFeather = (power, radius, now) => Math.sin(now * 0.012) * radius * (0.035 / 0.045) * (0.25 + unit(power) * 0.75);

export function sampleCueStrokeTimeline({ elapsed = 0, pullbackDuration = 0,
  strikeDuration = 120, holdDuration = 50, recoverDuration = 0,
  animationStyle = 'classic', strikeWindowRatio = 0.22, hitArmRatio = 0.88 } = {}) {
  const pull = Math.max(0, pullbackDuration), strike = Math.max(0, strikeDuration);
  const hold = Math.max(0, holdDuration), recover = Math.max(0, recoverDuration);
  const time = Math.max(0, elapsed);
  if (pull > 0 && time < pull) return { phase: 'pullback', t: unit(time / pull), hitArmed: false, done: false };
  if (strike > 0 && time < pull + strike) {
    const progress = unit((time - pull) / strike);
    // A single continuous push; phase boundaries must never move the cue backward.
    const contactTime = THREE.MathUtils.clamp(hitArmRatio, 0.5, 1);
    const t = unit(progress / contactTime);
    const eased = animationStyle === 'linear' ? t : t * t;
    return { phase: progress < 1 - strikeWindowRatio ? 'release' : 'strike', t: eased,
      hitArmed: progress >= contactTime, done: false };
  }
  if (hold > 0 && time < pull + strike + hold) return { phase: 'hold', t: 1, hitArmed: true, done: false };
  if (recover > 0 && time < pull + strike + hold + recover) return {
    phase: 'recover', t: unit((time - pull - strike - hold) / recover), hitArmed: true, done: false
  };
  return { phase: 'done', t: 1, hitArmed: true, done: true };
}

/** The rounded leather cap touches the sphere, including spin and cue tilt. */
export function resolveCueBallContact(ball, direction, offset, ballRadius, tipRadius) {
  const axis = direction.clone().normalize();
  const lateral = offset.clone().addScaledVector(axis, -offset.dot(axis));
  lateral.clampLength(0, ballRadius * 0.85);
  const along = Math.sqrt(Math.max(0, (ballRadius + tipRadius) ** 2 - lateral.lengthSq()));
  return ball.clone().add(lateral).addScaledVector(axis, tipRadius - along);
}

/** Move the visible cue BEFORE launching physics; even a skipped frame hits once. */
export function advancePoolRoyalCueStroke(cue, stroke, now) {
  let sample = sampleCueStrokeTimeline({ ...stroke, elapsed: now - stroke.startTime });
  if (!stroke.shotApplied) {
    if (sample.phase === 'pullback') cue.position.lerpVectors(stroke.idlePos, stroke.pullPos, THREE.MathUtils.smoothstep(sample.t, 0, 1));
    else cue.position.lerpVectors(stroke.pullPos, stroke.contactPos, sample.t);
    if (sample.hitArmed) {
      cue.position.copy(stroke.contactPos);
      stroke.shotApplied = true;
      stroke.impactAt = now;
      stroke.onImpact?.();
      // Contact is visible for this frame, even if the entire release was skipped.
      sample = { phase: 'strike', t: 1, hitArmed: true, done: false };
    }
  } else {
    const elapsed = Math.max(0, now - stroke.impactAt);
    const followMs = Math.max(50, stroke.holdDuration ?? 120);
    const recoverMs = Math.max(0, stroke.recoverDuration ?? 0);
    const follow = stroke.followPos ?? stroke.contactPos;
    if (elapsed < followMs) {
      cue.position.lerpVectors(stroke.contactPos, follow, easeOut(elapsed / followMs));
      sample = { phase: 'hold', t: 1, hitArmed: true, done: false };
    } else if (elapsed < followMs + recoverMs) {
      const t = (elapsed - followMs) / recoverMs;
      cue.position.lerpVectors(follow, stroke.idlePos, THREE.MathUtils.smoothstep(t, 0, 1));
      sample = { phase: 'recover', t, hitArmed: true, done: false };
    } else {
      cue.position.copy(follow);
      sample = { phase: 'done', t: 1, hitArmed: true, done: true };
    }
  }
  stroke.phase = sample.phase;
  cue.visible = !sample.done;
  return sample;
}
