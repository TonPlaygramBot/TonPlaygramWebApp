import { coachingDefinition } from '../config/poolRoyalCoaching.js';
const TRAINING_PROGRESS_KEY = 'poolRoyaleTrainingProgress'
export const TRAINING_LEVEL_COUNT = 50
const BASE_ATTEMPTS_PER_LEVEL = 3
const clampLevel = (value, fallback = 1) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(1, Math.min(TRAINING_LEVEL_COUNT, Math.floor(numeric))) : fallback;
};
const buildTrainingDefinition = level => ({ ...coachingDefinition(level),
  discipline: 'Pool skills', rewardAmount: level * 100,
  reward: `${(level * 100).toLocaleString('en-US')} TPG` });

export const TRAINING_LEVELS = Array.from(
  { length: TRAINING_LEVEL_COUNT },
  (_, idx) => buildTrainingDefinition(idx + 1)
)

export function describeTrainingLevel (level) {
  const normalized = clampLevel(level)
  return TRAINING_LEVELS[normalized - 1] || buildTrainingDefinition(normalized)
}

export function getTrainingLayout (level) {
  return describeTrainingLevel(level).layout
}

// The free-practice rack uses the production diameter-aware rack generator.
// These normalized coordinates retain a full-size, unclamped triangle for previews.
export function getPracticeLayout () {
  const spacing = .16;
  const balls = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      balls.push({ rackIndex: balls.length, x: (col - row / 2) * spacing,
        z: .2 + row * spacing * Math.sqrt(3) / 4 });
    }
  }
  return { cue: { x: 0, z: -.7 }, balls };
}

export function loadTrainingProgress () {
  if (typeof window === 'undefined') { return { completed: [], rewarded: [], lastLevel: 1, carryShots: 0, attemptsAwardedLevels: [] } }
  try {
    const stored = window.localStorage.getItem(TRAINING_PROGRESS_KEY)
    if (!stored) return { completed: [], rewarded: [], lastLevel: 1, carryShots: 0, attemptsAwardedLevels: [] }
    const parsed = JSON.parse(stored)
    const completed = Array.isArray(parsed?.completed)
      ? parsed.completed
        .map((lvl) => Number(lvl))
        .filter((lvl) => Number.isFinite(lvl) && lvl > 0)
        .sort((a, b) => a - b)
      : []
    const rewarded = Array.isArray(parsed?.rewarded)
      ? parsed.rewarded
        .map((lvl) => Number(lvl))
        .filter((lvl) => Number.isFinite(lvl) && lvl > 0)
        .sort((a, b) => a - b)
      : []
    const lastLevel = clampLevel(parsed?.lastLevel, 1)
    const rawCarryShots = Number(parsed?.carryShots)
    const carryShots = Number.isFinite(rawCarryShots)
      ? Math.max(0, Math.floor(rawCarryShots))
      : 0
    const attemptsAwardedLevels = Array.isArray(parsed?.attemptsAwardedLevels)
      ? parsed.attemptsAwardedLevels
        .map((lvl) => Number(lvl))
        .filter((lvl) => Number.isFinite(lvl) && lvl > 0)
        .sort((a, b) => a - b)
      : []
    const mastery = Object.fromEntries(Object.entries(parsed?.mastery || {}).filter(([level, stars]) => Number(level) >= 1 && Number(level) <= TRAINING_LEVEL_COUNT && Number.isInteger(stars) && stars >= 1 && stars <= 3));
    return { completed, rewarded, lastLevel, carryShots, attemptsAwardedLevels, mastery }
  } catch (err) {
    console.warn('Failed to load Pool Royale training progress', err)
    return { completed: [], rewarded: [], lastLevel: 1, carryShots: 0, attemptsAwardedLevels: [] }
  }
}

export { BASE_ATTEMPTS_PER_LEVEL }

export function addTrainingAttempts (attempts) {
  const parsedAttempts = Number(attempts)
  if (!Number.isFinite(parsedAttempts) || parsedAttempts <= 0) {
    return loadTrainingProgress()
  }
  const previous = loadTrainingProgress()
  const nextCarryShots = Math.max(0, Number(previous?.carryShots) || 0) + Math.floor(parsedAttempts)
  const updated = {
    ...previous,
    carryShots: nextCarryShots
  }
  persistTrainingProgress(updated)
  return updated
}

export function persistTrainingProgress (progress) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      TRAINING_PROGRESS_KEY,
      JSON.stringify(progress)
    )
  } catch (err) {
    console.warn('Failed to persist Pool Royale training progress', err)
  }
}

export function getNextIncompleteLevel (completedLevels) {
  const completedSet = new Set(
    (completedLevels || []).map((lvl) => Number(lvl))
  )
  for (let level = 1; level <= TRAINING_LEVEL_COUNT; level++) {
    if (!completedSet.has(level)) return level
  }
  return null
}

export function resolvePlayableTrainingLevel (requestedLevel, progress) {
  const completed = progress?.completed || []
  const nextIncomplete = getNextIncompleteLevel(completed)
  const lastLevel = clampLevel(progress?.lastLevel, 1)
  const desired =
    Number.isFinite(requestedLevel) && requestedLevel > 0
      ? requestedLevel
      : nextIncomplete || lastLevel || 1

  if (nextIncomplete !== null) {
    const cappedDesired = clampLevel(desired)
    if (cappedDesired <= nextIncomplete) {
      return cappedDesired
    }
    return clampLevel(nextIncomplete)
  }

  return clampLevel(desired, lastLevel || TRAINING_LEVEL_COUNT)
}
