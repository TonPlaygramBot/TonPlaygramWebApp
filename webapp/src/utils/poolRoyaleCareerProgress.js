import {
  TRAINING_LEVEL_COUNT,
  describeTrainingLevel
} from './poolRoyaleTrainingProgress.js'

const CAREER_PROGRESS_STORAGE_VERSION = 2
const CAREER_PROGRESS_KEY = `poolRoyaleCareerProgress_v${CAREER_PROGRESS_STORAGE_VERSION}`
const LEGACY_CAREER_PROGRESS_KEYS = ['poolRoyaleCareerProgress', 'poolRoyaleCareerProgress_v1']
export const CAREER_LEVEL_COUNT = 100

const FRIENDLY_TITLES = [
  'Scout Friendly',
  'Club Exhibition',
  'Prime Time Friendly',
  'Captain Challenge'
]

const TOURNAMENT_TITLES = [
  'Rookie Cup',
  'Regional Clash',
  'National Masters',
  'Continental Open',
  'Legend Circuit'
]

const CAREER_TRAINING_STAGE_COUNT = TRAINING_LEVEL_COUNT

const getStageType = (level) => {
  if (level <= CAREER_TRAINING_STAGE_COUNT) return 'training'
  if (level % 10 === 0) return 'tournament'
  if (level % 4 === 0) return 'friendly'
  return 'training'
}

const getTournamentPlayers = (level) => {
  if (level <= 20) return 8
  if (level <= 60) return 16
  return 32
}

const getTrainingLevel = (level) => ((level - 1) % TRAINING_LEVEL_COUNT) + 1

const buildReward = (level, type) => {
  const tpc =
    120 +
    level * 22 +
    (type === 'tournament' ? 380 : type === 'friendly' ? 160 : 0)
  const hasGift = level % 5 === 0
  return {
    tpc,
    hasGift,
    label: `${tpc.toLocaleString('en-US')} TPC${hasGift ? ' + 🎁 Bonus Crate' : ''}`
  }
}

const buildStage = (level) => {
  const type = getStageType(level)
  const phaseIndex = Math.min(4, Math.floor((level - 1) / 20))
  const trainingLevel = type === 'training' ? getTrainingLevel(level) : null
  const reward = buildReward(level, type)

  if (type === 'training') {
    const trainingTask = describeTrainingLevel(trainingLevel || 1)
    return {
      id: `career-stage-${String(level).padStart(3, '0')}`,
      level,
      phase: phaseIndex + 1,
      title: trainingTask.title,
      type,
      icon: '🎯',
      objective: trainingTask.objective,
      reward: trainingTask.reward,
      rewardTpc: Number(trainingTask.rewardAmount) || reward.tpc,
      hasGift: reward.hasGift,
      trainingLevel,
      players: null
    }
  }

  const titleSource =
    type === 'friendly'
      ? FRIENDLY_TITLES
      : TOURNAMENT_TITLES
  const titleBase = titleSource[(level - 1) % titleSource.length]

  return {
    id: `career-stage-${String(level).padStart(3, '0')}`,
    level,
    phase: phaseIndex + 1,
    title: `${titleBase} ${String(level).padStart(2, '0')}`,
    type,
    icon: type === 'friendly' ? '🤝' : '🏆',
    objective:
      type === 'friendly'
        ? 'Win a tactical friendly against an adaptive AI rival.'
        : `Win a ${getTournamentPlayers(level)}-player bracket and secure promotion.`,
    reward: reward.label,
    rewardTpc: reward.tpc,
    hasGift: reward.hasGift,
    trainingLevel,
    players: type === 'tournament' ? getTournamentPlayers(level) : null
  }
}

export const CAREER_STAGES = Array.from(
  { length: CAREER_LEVEL_COUNT },
  (_, idx) => buildStage(idx + 1)
)

const normalizeProgress = (value) => {
  const completed = Array.isArray(value?.completedStageIds)
    ? value.completedStageIds.filter(
      (entry) => typeof entry === 'string' && entry.trim()
    )
    : []
  return {
    completedStageIds: [...new Set(completed)],
    updatedAt: Number(value?.updatedAt) || Date.now()
  }
}

export function loadCareerProgress () {
  if (typeof window === 'undefined') return normalizeProgress(null)
  try {
    LEGACY_CAREER_PROGRESS_KEYS.forEach((legacyKey) => {
      if (!legacyKey || legacyKey === CAREER_PROGRESS_KEY) return
      window.localStorage.removeItem(legacyKey)
    })
    const raw = window.localStorage.getItem(CAREER_PROGRESS_KEY)
    if (!raw) return normalizeProgress(null)
    return normalizeProgress(JSON.parse(raw))
  } catch (err) {
    console.warn('Failed to load Pool Royale career progress', err)
    return normalizeProgress(null)
  }
}

export function persistCareerProgress (progress) {
  const normalized = normalizeProgress(progress)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        CAREER_PROGRESS_KEY,
        JSON.stringify(normalized)
      )
    } catch (err) {
      console.warn('Failed to save Pool Royale career progress', err)
    }
  }
  return normalized
}

export function markCareerStageCompleted (stageId) {
  if (!stageId) return loadCareerProgress()
  const current = loadCareerProgress()
  if (current.completedStageIds.includes(stageId)) return current
  return persistCareerProgress({
    ...current,
    completedStageIds: [...current.completedStageIds, stageId],
    updatedAt: Date.now()
  })
}

export function syncCareerProgressWithTraining (
  _trainingProgress,
  careerProgress = loadCareerProgress()
) {
  return normalizeProgress(careerProgress)
}

export function getCareerRoadmap (
  _trainingProgress,
  careerProgress = loadCareerProgress()
) {
  const completedCareer = new Set(careerProgress.completedStageIds || [])

  let previousLocked = false
  return CAREER_STAGES.map((stage) => {
    const completed = completedCareer.has(stage.id)
    const locked = previousLocked
    const playable = !locked && !completed
    if (!completed) previousLocked = true
    return {
      ...stage,
      completed,
      locked,
      playable,
      statusLabel: completed ? 'Completed' : locked ? 'Locked' : 'Active'
    }
  })
}

export function getNextCareerStage (
  trainingProgress,
  careerProgress = loadCareerProgress()
) {
  const roadmap = getCareerRoadmap(trainingProgress, careerProgress)
  return roadmap.find((stage) => stage.playable) || null
}
