const TRAINING_PROGRESS_KEY = 'poolRoyaleTrainingProgress'
const TRAINING_LEVEL_COUNT = 50

const clampLevel = (value, fallback = 1) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(1, Math.min(TRAINING_LEVEL_COUNT, Math.floor(numeric)))
}

const rotate = (arr, offset) => {
  if (!Array.isArray(arr) || arr.length === 0) return []
  const shift = ((offset % arr.length) + arr.length) % arr.length
  return [...arr.slice(shift), ...arr.slice(0, shift)]
}

const buildTrainingLayout = (level) => {
  const ring = [
    { x: -0.52, z: -0.18 },
    { x: -0.36, z: 0.12 },
    { x: -0.14, z: -0.08 },
    { x: 0.08, z: 0.2 },
    { x: 0.24, z: -0.15 },
    { x: 0.38, z: 0.11 },
    { x: 0.54, z: -0.06 },
    { x: -0.46, z: 0.32 },
    { x: -0.22, z: 0.33 },
    { x: 0.03, z: 0.36 },
    { x: 0.26, z: 0.31 },
    { x: 0.49, z: 0.28 },
    { x: -0.33, z: -0.33 },
    { x: -0.07, z: -0.35 },
    { x: 0.2, z: -0.32 }
  ]
  const targetCount = Math.min(15, Math.max(1, level))
  const rotated = rotate(ring, level - 1)
  const spacingOffset = (level % 5) * 0.01
  const balls = rotated.slice(0, targetCount).map((pos, idx) => ({
    rackIndex: idx,
    x: pos.x + (idx % 2 === 0 ? spacingOffset : -spacingOffset),
    z: pos.z
  }))

  return {
    cue: { x: -0.68 + (level % 3) * 0.05, z: 0.52 - (level % 4) * 0.08 },
    balls
  }
}

const buildTrainingDefinition = (level) => {
  const discipline =
    level <= 17 ? '8-Ball' : level <= 34 ? '9-Ball' : 'American Billiards'
  const targetCount = Math.min(15, level)
  const reward =
    level % 5 === 0
      ? 'Free random table setup item unlocked.'
      : 'Progress toward next free table setup item.'

  return {
    level,
    discipline,
    title: `${discipline} Drill ${String(level).padStart(2, '0')}`,
    objective:
      level <= 15
        ? `Pot ${targetCount} ball${targetCount > 1 ? 's' : ''} without scratching.`
        : `Clear ${targetCount} planned balls from a mixed ${discipline} layout.`,
    reward,
    layout: buildTrainingLayout(level)
  }
}

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

export function loadTrainingProgress () {
  if (typeof window === 'undefined') { return { completed: [], lastLevel: 1, carryShots: 3 } }
  try {
    const stored = window.localStorage.getItem(TRAINING_PROGRESS_KEY)
    if (!stored) return { completed: [], lastLevel: 1, carryShots: 3 }
    const parsed = JSON.parse(stored)
    const completed = Array.isArray(parsed?.completed)
      ? parsed.completed
        .map((lvl) => Number(lvl))
        .filter((lvl) => Number.isFinite(lvl) && lvl > 0)
        .sort((a, b) => a - b)
      : []
    const lastLevel = clampLevel(parsed?.lastLevel, 1)
    const carryShots = Math.max(0, Math.floor(Number(parsed?.carryShots) || 3))
    return { completed, lastLevel, carryShots }
  } catch (err) {
    console.warn('Failed to load Pool Royale training progress', err)
    return { completed: [], lastLevel: 1, carryShots: 3 }
  }
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
