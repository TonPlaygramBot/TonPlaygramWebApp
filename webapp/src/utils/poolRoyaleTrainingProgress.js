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

const LAYOUT_ANCHORS = [
  { x: -0.52, z: -0.23 },
  { x: -0.43, z: 0.03 },
  { x: -0.28, z: -0.12 },
  { x: -0.16, z: 0.16 },
  { x: -0.02, z: -0.21 },
  { x: 0.1, z: 0.19 },
  { x: 0.24, z: -0.12 },
  { x: 0.35, z: 0.14 },
  { x: 0.48, z: -0.05 },
  { x: -0.36, z: 0.31 },
  { x: -0.19, z: 0.35 },
  { x: -0.01, z: 0.31 },
  { x: 0.18, z: 0.34 },
  { x: 0.35, z: 0.29 },
  { x: 0.52, z: 0.24 },
  { x: -0.32, z: -0.34 },
  { x: -0.12, z: -0.36 },
  { x: 0.08, z: -0.34 },
  { x: 0.28, z: -0.33 },
  { x: 0.48, z: -0.29 }
]

const TRAINING_STRATEGIES = [
  'Stop-shot center ball control',
  'Natural angle rolling cue ball',
  'Stun to hold for next shot',
  'Two-rail position play',
  'Three-ball pattern planning',
  'Key-ball and breakout timing',
  'Safety-first cue ball parking',
  'Thin cut pocketing confidence',
  'Rail-first recovery shots',
  'End-game cluster management'
]

const TRAINING_TASKS = Array.from({ length: TRAINING_LEVEL_COUNT }, (_, idx) => {
  const level = idx + 1
  const discipline =
    level <= 17 ? '8-Ball' : level <= 34 ? '9-Ball' : 'American Billiards'
  const strategy = TRAINING_STRATEGIES[idx % TRAINING_STRATEGIES.length]
  const ballCount = 2 + (idx % 11)
  return {
    level,
    discipline,
    strategy,
    ballCount,
    title: `${discipline} Drill ${String(level).padStart(2, '0')}`,
    objective: `Clear ${ballCount} planned object ball${ballCount > 1 ? 's' : ''} using ${strategy.toLowerCase()}.`,
    reward:
      level % 5 === 0
        ? 'Free random table setup item unlocked.'
        : 'Progress toward next free table setup item.'
  }
})

const buildTrainingLayout = (level, ballCount) => {
  const rotated = rotate(LAYOUT_ANCHORS, level - 1)
  const laneOffset = ((level % 4) - 1.5) * 0.014
  const balls = rotated.slice(0, Math.max(1, Math.min(15, ballCount))).map((pos, idx) => ({
    rackIndex: idx,
    x: pos.x + (idx % 2 === 0 ? laneOffset : -laneOffset),
    z: pos.z + ((level + idx) % 3 === 0 ? 0.012 : -0.01)
  }))

  return {
    cue: {
      x: -0.7 + (level % 5) * 0.055,
      z: 0.5 - (level % 6) * 0.12
    },
    balls
  }
}

const buildTrainingDefinition = (level) => {
  const task = TRAINING_TASKS[clampLevel(level) - 1] || TRAINING_TASKS[0]
  return {
    ...task,
    layout: buildTrainingLayout(task.level, task.ballCount)
  }
}

export const TRAINING_LEVELS = TRAINING_TASKS.map((task) => ({
  ...task,
  layout: buildTrainingLayout(task.level, task.ballCount)
}))

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
