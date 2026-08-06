export const DICE_FACE_MIN = 1;
export const DICE_FACE_MAX = 6;
export const LUDO_BATTLE_ROYAL_DICE_TICK_MS = 50;
export const LUDO_BATTLE_ROYAL_DICE_ITERATIONS = 20;

export function clampDiceFace(value, fallback = DICE_FACE_MIN) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(DICE_FACE_MIN, Math.min(DICE_FACE_MAX, Math.floor(numeric)));
}

export function rollLudoBattleRoyalDiceFace(rng = Math.random) {
  return DICE_FACE_MIN + Math.floor(rng() * DICE_FACE_MAX);
}

export function rollLudoBattleRoyalDiceValues(count = 1, rng = Math.random) {
  const diceCount = Math.max(1, Math.floor(Number(count) || 1));
  return Array.from({ length: diceCount }, () => rollLudoBattleRoyalDiceFace(rng));
}

export function normalizeDiceRollValues(value, fallbackCount = 1) {
  if (Array.isArray(value)) {
    return value
      .map((candidate) => Number(candidate))
      .filter((candidate) => Number.isFinite(candidate))
      .map((candidate) => clampDiceFace(candidate));
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return [clampDiceFace(numeric)];
  }

  return Array(Math.max(1, Math.floor(Number(fallbackCount) || 1))).fill(DICE_FACE_MIN);
}

export function createLudoBattleRoyalDiceSpin(rng = Math.random) {
  return {
    spin: {
      x: 1.2 + rng() * 0.7,
      y: 1.35 + rng() * 0.65,
      z: 1.05 + rng() * 0.75
    },
    wobble: {
      x: (rng() - 0.5) * 0.16,
      y: 0,
      z: (rng() - 0.5) * 0.16
    },
    value: rollLudoBattleRoyalDiceFace(rng)
  };
}
