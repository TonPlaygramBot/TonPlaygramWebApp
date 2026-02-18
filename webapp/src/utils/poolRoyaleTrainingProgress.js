const TRAINING_PROGRESS_KEY = 'poolRoyaleTrainingProgress'
const TRAINING_LEVEL_COUNT = 50
const BASE_ATTEMPTS_PER_LEVEL = 3
const TRAINING_MAX_LAYOUT_BALLS = 25

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
  { title: 'Stop Shot Basics', objective: 'Pocket the balls and keep cue-ball control.' },
  { title: 'Cut Shot Basics', objective: 'Pocket medium cut shots with smooth aim.' },
  { title: 'Rail Recovery', objective: 'Use one rail and stay in position.' },
  { title: 'Two-Rail Control', objective: 'Use two rails to move to your next ball.' },
  { title: 'Stun & Draw', objective: 'Mix stun and draw to stay on line.' },
  { title: 'Inside Spin', objective: 'Use inside spin to hold your angle.' },
  { title: 'Outside Spin', objective: 'Use outside spin to open the pocket line.' },
  { title: 'Break Cluster', objective: 'Open a cluster and keep one easy shot.' },
  { title: 'Safety Recovery', objective: 'Escape pressure and continue the run.' },
  { title: 'Final Balls', objective: 'Finish the last balls with calm pace.' }
]

const PATTERN_LIBRARY = [
  [
    { x: -0.56, z: -0.34 }, { x: -0.43, z: -0.24 }, { x: -0.3, z: -0.15 }, { x: -0.16, z: -0.06 },
    { x: -0.02, z: 0.03 }, { x: 0.12, z: 0.12 }, { x: 0.27, z: 0.2 }, { x: 0.41, z: 0.27 },
    { x: 0.53, z: 0.14 }, { x: 0.49, z: -0.02 }, { x: 0.36, z: -0.12 }, { x: 0.23, z: -0.22 },
    { x: 0.08, z: -0.31 }, { x: -0.08, z: -0.33 }, { x: -0.24, z: -0.31 }, { x: -0.38, z: -0.23 },
    { x: -0.5, z: -0.11 }, { x: -0.52, z: 0.05 }, { x: -0.45, z: 0.19 }, { x: -0.3, z: 0.29 }
  ],
  [
    { x: -0.52, z: 0.3 }, { x: -0.39, z: 0.22 }, { x: -0.25, z: 0.13 }, { x: -0.1, z: 0.04 },
    { x: 0.04, z: -0.06 }, { x: 0.18, z: -0.15 }, { x: 0.33, z: -0.22 }, { x: 0.48, z: -0.27 },
    { x: 0.56, z: -0.11 }, { x: 0.5, z: 0.03 }, { x: 0.37, z: 0.12 }, { x: 0.22, z: 0.2 },
    { x: 0.06, z: 0.28 }, { x: -0.1, z: 0.33 }, { x: -0.26, z: 0.33 }, { x: -0.4, z: 0.28 },
    { x: -0.51, z: 0.16 }, { x: -0.55, z: 0.01 }, { x: -0.48, z: -0.13 }, { x: -0.33, z: -0.24 }
  ],
  [
    { x: -0.5, z: -0.02 }, { x: -0.36, z: 0.08 }, { x: -0.36, z: -0.12 }, { x: -0.22, z: 0.17 },
    { x: -0.22, z: -0.21 }, { x: -0.07, z: 0.24 }, { x: -0.07, z: -0.28 }, { x: 0.08, z: 0.3 },
    { x: 0.08, z: -0.34 }, { x: 0.23, z: 0.23 }, { x: 0.23, z: -0.27 }, { x: 0.37, z: 0.14 },
    { x: 0.37, z: -0.18 }, { x: 0.49, z: 0.04 }, { x: 0.49, z: -0.05 }, { x: -0.5, z: 0.21 },
    { x: -0.5, z: -0.24 }, { x: 0.21, z: 0.33 }, { x: 0.21, z: -0.35 }, { x: 0.53, z: 0.24 }
  ],
  [
    { x: -0.56, z: 0.35 }, { x: -0.43, z: 0.28 }, { x: -0.29, z: 0.2 }, { x: -0.14, z: 0.13 },
    { x: 0.01, z: 0.06 }, { x: 0.16, z: -0.01 }, { x: 0.31, z: -0.08 }, { x: 0.45, z: -0.16 },
    { x: 0.56, z: -0.27 }, { x: 0.43, z: -0.31 }, { x: 0.28, z: -0.34 }, { x: 0.12, z: -0.35 },
    { x: -0.04, z: -0.34 }, { x: -0.2, z: -0.3 }, { x: -0.35, z: -0.24 }, { x: -0.49, z: -0.16 },
    { x: -0.55, z: -0.02 }, { x: -0.52, z: 0.12 }, { x: -0.41, z: 0.22 }, { x: -0.25, z: 0.3 }
  ],
  [
    { x: -0.47, z: 0.34 }, { x: -0.31, z: 0.33 }, { x: -0.15, z: 0.34 }, { x: 0.01, z: 0.34 },
    { x: 0.17, z: 0.33 }, { x: 0.33, z: 0.29 }, { x: 0.48, z: 0.23 }, { x: 0.56, z: 0.1 },
    { x: 0.54, z: -0.05 }, { x: 0.46, z: -0.18 }, { x: 0.32, z: -0.27 }, { x: 0.16, z: -0.33 },
    { x: 0, z: -0.35 }, { x: -0.16, z: -0.35 }, { x: -0.32, z: -0.31 }, { x: -0.46, z: -0.24 },
    { x: -0.54, z: -0.11 }, { x: -0.55, z: 0.04 }, { x: -0.5, z: 0.18 }, { x: -0.39, z: 0.28 }
  ]
]

const getTrainingTargetCount = (level) => {
  const normalized = clampLevel(level)
  return normalized <= TRAINING_MAX_LAYOUT_BALLS ? normalized : TRAINING_MAX_LAYOUT_BALLS
}

const clampLayoutCoord = (value, min, max) => Math.max(min, Math.min(max, value))

const stabilizeTrainingSlot = (slot) => {
  const safe = {
    x: clampLayoutCoord(slot?.x ?? 0, -0.44, 0.44),
    z: clampLayoutCoord(slot?.z ?? 0, -0.31, 0.31)
  }

  const nearCornerPocket = Math.abs(safe.x) > 0.44 && Math.abs(safe.z) > 0.24
  if (nearCornerPocket) {
    safe.x = Math.sign(safe.x || 1) * 0.42
    safe.z = Math.sign(safe.z || 1) * 0.22
  }

  return safe
}

const resolveLayoutSlot = (pattern, index, level) => {
  if (index < pattern.length) return pattern[index]

  const extraIndex = index - pattern.length
  const angle = ((extraIndex * 137.5) + (level * 11)) * (Math.PI / 180)
  const radius = 0.14 + (extraIndex * 0.052)

  return {
    x: clampLayoutCoord(Math.cos(angle) * radius, -0.56, 0.56),
    z: clampLayoutCoord(Math.sin(angle) * radius, -0.35, 0.35)
  }
}

const buildTrainingLayout = (level) => {
  const pattern = PATTERN_LIBRARY[(level - 1) % PATTERN_LIBRARY.length] || PATTERN_LIBRARY[0]
  const targetCount = getTrainingTargetCount(level)
  const rotated = rotate(pattern, (level * 2) % pattern.length)
  const microShift = ((level % 4) - 1.5) * 0.008
  const balls = Array.from({ length: targetCount }, (_, idx) => {
    const rawPos = resolveLayoutSlot(rotated, idx, level)
    const pos = stabilizeTrainingSlot(rawPos)
    let x = clampLayoutCoord(pos.x + (idx % 2 === 0 ? microShift : -microShift), -0.44, 0.44)
    let z = clampLayoutCoord(pos.z + (idx % 3 === 0 ? microShift : 0), -0.31, 0.31)
    if (Math.abs(x) > 0.4 && Math.abs(z) > 0.24) {
      x = Math.sign(x || 1) * 0.39
      z = Math.sign(z || 1) * 0.22
    }
    return {
      rackIndex: idx,
      x,
      z
    }
  })

  return {
    cue: { x: -0.7 + (level % 5) * 0.045, z: 0.5 - (level % 6) * 0.065 },
    balls
  }
}

const buildTrainingDefinition = (level) => {
  const discipline = level <= 17 ? '8-Ball' : level <= 34 ? '9-Ball' : 'Pool Position Play'
  const targetCount = getTrainingTargetCount(level)
  const strategy = STRATEGY_DRILLS[(level - 1) % STRATEGY_DRILLS.length]
  const rewardAmount = level * 100
  const reward = `${rewardAmount.toLocaleString('en-US')} TPC`

  return {
    level,
    discipline,
    title: `Task ${String(level).padStart(2, '0')} · ${strategy.title}`,
    objective: `${strategy.objective} Clear ${targetCount} ball${targetCount > 1 ? 's' : ''}.`,
    rewardAmount,
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
  if (typeof window === 'undefined') { return { completed: [], rewarded: [], lastLevel: 1, carryShots: BASE_ATTEMPTS_PER_LEVEL } }
  try {
    const stored = window.localStorage.getItem(TRAINING_PROGRESS_KEY)
    if (!stored) return { completed: [], rewarded: [], lastLevel: 1, carryShots: BASE_ATTEMPTS_PER_LEVEL }
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
    const carryShots = Math.max(0, Math.floor(Number(parsed?.carryShots) || BASE_ATTEMPTS_PER_LEVEL))
    return { completed, rewarded, lastLevel, carryShots }
  } catch (err) {
    console.warn('Failed to load Pool Royale training progress', err)
    return { completed: [], rewarded: [], lastLevel: 1, carryShots: BASE_ATTEMPTS_PER_LEVEL }
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
