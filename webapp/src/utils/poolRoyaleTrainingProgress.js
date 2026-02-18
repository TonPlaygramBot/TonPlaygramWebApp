const TRAINING_PROGRESS_KEY = 'poolRoyaleTrainingProgress'
const TRAINING_LEVEL_COUNT = 50
const BASE_ATTEMPTS_PER_LEVEL = 3

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

const STRATEGY_DRILLS = [
  { title: 'Straight-in stop shot', objective: 'Pot all balls using a controlled stop-shot finish.' },
  { title: 'Half-ball cuts', objective: 'Clear the table by controlling medium cut angles.' },
  { title: 'Rail-first recovery', objective: 'Use at least one rail route to stay on sequence.' },
  { title: 'Two-rail position play', objective: 'Run out while planning two-rail cue-ball paths.' },
  { title: 'Stun-to-draw ladder', objective: 'Mix stun and draw so each next ball is high percentage.' },
  { title: 'Inside spin navigation', objective: 'Use inside english to hold lines on cut shots.' },
  { title: 'Outside spin escapes', objective: 'Apply outside spin to widen pocket approach windows.' },
  { title: 'Breakout pattern drill', objective: 'Open clustered balls and preserve an easy insurance shot.' },
  { title: 'Safety-to-attack conversion', objective: 'Recover from a tight leave and continue the runout.' },
  { title: 'End-game precision', objective: 'Finish the final balls with conservative cue-ball speed.' }
]

const PATTERN_LIBRARY = [
  [
    { x: -0.54, z: -0.28 }, { x: -0.38, z: -0.16 }, { x: -0.22, z: -0.04 }, { x: -0.06, z: 0.08 },
    { x: 0.1, z: 0.2 }, { x: 0.26, z: 0.3 }, { x: 0.43, z: 0.33 }, { x: 0.53, z: 0.12 },
    { x: 0.41, z: -0.08 }, { x: 0.25, z: -0.2 }, { x: 0.09, z: -0.3 }, { x: -0.09, z: -0.35 },
    { x: -0.28, z: -0.3 }, { x: -0.45, z: -0.18 }, { x: -0.51, z: 0.02 }
  ],
  [
    { x: -0.5, z: 0.26 }, { x: -0.38, z: 0.12 }, { x: -0.26, z: -0.02 }, { x: -0.14, z: -0.18 },
    { x: -0.02, z: -0.32 }, { x: 0.13, z: -0.24 }, { x: 0.27, z: -0.12 }, { x: 0.42, z: -0.03 },
    { x: 0.54, z: 0.14 }, { x: 0.36, z: 0.25 }, { x: 0.18, z: 0.34 }, { x: 0.02, z: 0.27 },
    { x: -0.17, z: 0.2 }, { x: -0.31, z: 0.32 }, { x: 0.05, z: 0.06 }
  ],
  [
    { x: -0.48, z: -0.01 }, { x: -0.32, z: 0.08 }, { x: -0.32, z: -0.12 }, { x: -0.15, z: 0.18 },
    { x: -0.15, z: -0.22 }, { x: 0.03, z: 0.27 }, { x: 0.03, z: -0.31 }, { x: 0.19, z: 0.14 },
    { x: 0.19, z: -0.18 }, { x: 0.34, z: 0.03 }, { x: 0.48, z: 0.2 }, { x: 0.5, z: -0.24 },
    { x: -0.01, z: -0.06 }, { x: 0.34, z: 0.33 }, { x: -0.47, z: 0.28 }
  ],
  [
    { x: -0.54, z: 0.34 }, { x: -0.38, z: 0.24 }, { x: -0.22, z: 0.16 }, { x: -0.04, z: 0.12 },
    { x: 0.14, z: 0.08 }, { x: 0.31, z: 0.02 }, { x: 0.47, z: -0.07 }, { x: 0.55, z: -0.22 },
    { x: 0.37, z: -0.27 }, { x: 0.2, z: -0.3 }, { x: 0.02, z: -0.34 }, { x: -0.16, z: -0.31 },
    { x: -0.33, z: -0.25 }, { x: -0.49, z: -0.12 }, { x: -0.44, z: 0.07 }
  ],
  [
    { x: -0.45, z: 0.33 }, { x: -0.27, z: 0.31 }, { x: -0.08, z: 0.34 }, { x: 0.11, z: 0.32 },
    { x: 0.3, z: 0.28 }, { x: 0.47, z: 0.21 }, { x: 0.53, z: 0.01 }, { x: 0.43, z: -0.15 },
    { x: 0.26, z: -0.25 }, { x: 0.07, z: -0.31 }, { x: -0.11, z: -0.34 }, { x: -0.29, z: -0.3 },
    { x: -0.46, z: -0.21 }, { x: -0.53, z: -0.03 }, { x: -0.01, z: 0.04 }
  ]
]

const buildTrainingLayout = (level) => {
  const pattern = PATTERN_LIBRARY[(level - 1) % PATTERN_LIBRARY.length] || PATTERN_LIBRARY[0]
  const targetCount = Math.max(3, Math.min(15, 3 + Math.floor((level - 1) / 2)))
  const rotated = rotate(pattern, (level * 2) % pattern.length)
  const microShift = ((level % 4) - 1.5) * 0.008
  const balls = rotated.slice(0, targetCount).map((pos, idx) => ({
    rackIndex: idx,
    x: pos.x + (idx % 2 === 0 ? microShift : -microShift),
    z: pos.z + (idx % 3 === 0 ? microShift : 0)
  }))

  return {
    cue: { x: -0.7 + (level % 5) * 0.045, z: 0.5 - (level % 6) * 0.065 },
    balls
  }
}

const buildTrainingDefinition = (level) => {
  const discipline = level <= 17 ? '8-Ball' : level <= 34 ? '9-Ball' : 'Pool Position Play'
  const targetCount = Math.max(3, Math.min(15, 3 + Math.floor((level - 1) / 2)))
  const strategy = STRATEGY_DRILLS[(level - 1) % STRATEGY_DRILLS.length]
  const reward =
    level % 5 === 0
      ? 'Free random table setup item unlocked.'
      : 'Progress toward next free table setup item.'

  return {
    level,
    discipline,
    title: `${strategy.title} #${String(level).padStart(2, '0')}`,
    objective: `${strategy.objective} Clear ${targetCount} planned ball${targetCount > 1 ? 's' : ''}.`,
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
  if (typeof window === 'undefined') { return { completed: [], lastLevel: 1, carryShots: BASE_ATTEMPTS_PER_LEVEL } }
  try {
    const stored = window.localStorage.getItem(TRAINING_PROGRESS_KEY)
    if (!stored) return { completed: [], lastLevel: 1, carryShots: BASE_ATTEMPTS_PER_LEVEL }
    const parsed = JSON.parse(stored)
    const completed = Array.isArray(parsed?.completed)
      ? parsed.completed
        .map((lvl) => Number(lvl))
        .filter((lvl) => Number.isFinite(lvl) && lvl > 0)
        .sort((a, b) => a - b)
      : []
    const lastLevel = clampLevel(parsed?.lastLevel, 1)
    const carryShots = Math.max(0, Math.floor(Number(parsed?.carryShots) || BASE_ATTEMPTS_PER_LEVEL))
    return { completed, lastLevel, carryShots }
  } catch (err) {
    console.warn('Failed to load Pool Royale training progress', err)
    return { completed: [], lastLevel: 1, carryShots: BASE_ATTEMPTS_PER_LEVEL }
  }
}

export { BASE_ATTEMPTS_PER_LEVEL }

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
