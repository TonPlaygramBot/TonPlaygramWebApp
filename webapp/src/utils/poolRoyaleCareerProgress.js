import {
  TRAINING_LEVEL_COUNT,
  describeTrainingLevel
} from './poolRoyaleTrainingProgress.js'

const CAREER_PROGRESS_KEY = 'poolRoyaleCareerProgress_v2'
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

const CAREER_TYPE_SEQUENCE = [
  'training',
  'training',
  'friendly',
  'training',
  'league',
  'training',
  'friendly',
  'tournament',
  'training',
  'showdown'
]

const GIFT_THUMBNAILS = [
  '/store-thumbs/poolRoyale/tableFinish/oakVeneer01.png',
  '/store-thumbs/poolRoyale/tableFinish/woodTable001.png',
  '/store-thumbs/poolRoyale/tableFinish/peelingPaintWeathered.png'
]

const CAREER_TRAINING_STAGE_COUNT = TRAINING_LEVEL_COUNT

const getStageType = (level) => {
  if (level <= 6) return 'training'
  return CAREER_TYPE_SEQUENCE[(level - 1) % CAREER_TYPE_SEQUENCE.length]
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
    (type === 'tournament'
      ? 420
      : type === 'showdown'
        ? 520
        : type === 'league'
          ? 250
          : type === 'friendly'
            ? 160
            : 0)
  const hasGift = level % 5 === 0
  return {
    tpc,
    hasGift,
    giftThumbnail: hasGift
      ? GIFT_THUMBNAILS[(Math.floor(level / 5) - 1) % GIFT_THUMBNAILS.length]
      : null,
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
      giftThumbnail: reward.giftThumbnail,
      trainingLevel,
      players: null
    }
  }

  const stageMetaByType = {
    friendly: {
      titleBase: FRIENDLY_TITLES[(level - 1) % FRIENDLY_TITLES.length],
      icon: '🤝',
      objective: 'Win a tactical friendly against an adaptive AI rival.',
      players: null
    },
    league: {
      titleBase: 'League Fixture',
      icon: '🗓️',
      objective: 'Win the scheduled league match to keep your table ranking alive.',
      players: null
    },
    showdown: {
      titleBase: 'Rival Showdown',
      icon: '⚡',
      objective: 'Defeat the featured rival in a high-pressure race-to-win set.',
      players: 2
    },
    tournament: {
      titleBase: TOURNAMENT_TITLES[(level - 1) % TOURNAMENT_TITLES.length],
      icon: '🏆',
      objective: `Win a ${getTournamentPlayers(level)}-player bracket and secure promotion.`,
      players: getTournamentPlayers(level)
    }
  }

  const stageMeta = stageMetaByType[type] || stageMetaByType.friendly

  return {
    id: `career-stage-${String(level).padStart(3, '0')}`,
    level,
    phase: phaseIndex + 1,
    title: `${stageMeta.titleBase} ${String(level).padStart(2, '0')}`,
    type,
    icon: stageMeta.icon,
    objective: stageMeta.objective,
    reward: reward.label,
    rewardTpc: reward.tpc,
    hasGift: reward.hasGift,
    giftThumbnail: reward.giftThumbnail,
    trainingLevel,
    players: stageMeta.players
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
