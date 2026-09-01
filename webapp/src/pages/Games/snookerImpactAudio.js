const DEFAULT_REFERENCE_IMPULSE = 0.1;
const MIN_AUDIBLE_GAIN = 0.025;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashPairKey(pairKey) {
  const text = String(pairKey ?? '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

/**
 * Maps collision energy to a restrained snooker-ball sound. The square-root
 * response keeps gentle contacts audible without letting hard breaks clip,
 * while stable pair-based pitch variation prevents repeated contacts from
 * sounding like the exact same sample.
 */
export function resolveSnookerImpactAudio({
  impulse,
  shotPower = 1,
  referenceImpulse = DEFAULT_REFERENCE_IMPULSE,
  pairKey = ''
} = {}) {
  const safeImpulse = Number.isFinite(impulse) ? Math.max(0, impulse) : 0;
  const safeReference = Number.isFinite(referenceImpulse) && referenceImpulse > 0
    ? referenceImpulse
    : DEFAULT_REFERENCE_IMPULSE;
  const safePower = Number.isFinite(shotPower) ? clamp(shotPower, 0, 1) : 0;
  const normalizedEnergy = clamp(safeImpulse / safeReference, 0, 1);
  const gain = clamp(Math.sqrt(normalizedEnergy) * (0.5 + safePower * 0.5), 0, 1);

  if (gain < MIN_AUDIBLE_GAIN) {
    return { gain: 0, playbackRate: 1 };
  }

  const pairVariation = (hashPairKey(pairKey) - 0.5) * 0.035;
  const energyPitch = (normalizedEnergy - 0.5) * 0.05;
  return {
    gain,
    playbackRate: clamp(0.975 + pairVariation + energyPitch, 0.94, 1.04)
  };
}

