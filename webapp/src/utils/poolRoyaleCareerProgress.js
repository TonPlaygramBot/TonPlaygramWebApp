import { POOL_ROYAL_PLAYERS } from '../config/poolRoyalPlayers.js';
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
  'friendly',
  'training',
  'league',
  'friendly',
  'training',
  'tournament',
  'friendly',
  'league',
  'showdown',
  'training'
]

const GIFT_THUMBNAILS = [
  '/store-thumbs/poolRoyale/tableFinish/oakVeneer01.png',
  '/store-thumbs/poolRoyale/tableFinish/woodTable001.png',
  '/store-thumbs/poolRoyale/tableFinish/peelingPaintWeathered.png'
]

const CAREER_TRAINING_STAGE_COUNT = TRAINING_LEVEL_COUNT

const CAREER_PHASE_DETAILS = [
  {
    id: 1,
    title: 'Club apprentice',
    summary:
      'Focus on cue control, basic positioning, and winning your first mixed fixtures.'
  },
  {
    id: 2,
    title: 'County contender',
    summary:
      'Face stronger league rivals, keep streaks alive, and qualify for larger events.'
  },
  {
    id: 3,
    title: 'National challenger',
    summary:
      'Longer brackets, tighter tactical windows, and pressure-tested showdown tables.'
  },
  {
    id: 4,
    title: 'Tour professional',
    summary:
      'High-stakes draws with elite AI opponents and advanced positional requirements.'
  },
  {
    id: 5,
    title: 'World title campaign',
    summary:
      'Every frame counts: championship difficulty, prestige gifts, and top-tier payouts.'
  }
]

const getStageType = (level) => {
  if (level <= 2) return 'training'
  return CAREER_TYPE_SEQUENCE[(level - 1) % CAREER_TYPE_SEQUENCE.length]
}

const getStageDifficulty = (level) => {
  if (level <= 12) return 'Rookie'
  if (level <= 35) return 'Contender'
  if (level <= 65) return 'Pro'
  if (level <= 85) return 'Master'
  return 'Legend'
}

const getTournamentPlayers = (level) => {
  if (level <= 20) return 8
  if (level <= 60) return 16
  return 32
}

const getBracketRounds = (players) => {
  const safePlayers = Math.max(2, Number(players) || 2)
  return Math.max(1, Math.round(Math.log2(safePlayers)))
}

const getTrainingLevel = (level) => Math.min(TRAINING_LEVEL_COUNT, Math.floor((level - 1) / 20) * 10 + ((level - 1) % 10) + 1)

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
    label: `${tpc.toLocaleString('en-US')} TPG${hasGift ? ' + 🎁 Bonus Crate' : ''}`
  }
}

const buildStage = (level) => {
  const type = getStageType(level)
  const phaseIndex = Math.min(4, Math.floor((level - 1) / 20))
  const trainingLevel = type === 'training' ? getTrainingLevel(level) : null
  const reward = buildReward(level, type)
  const phase = phaseIndex + 1
  const phaseDetail =
    CAREER_PHASE_DETAILS.find((entry) => entry.id === phase) ||
    CAREER_PHASE_DETAILS[CAREER_PHASE_DETAILS.length - 1]
  const opponent = POOL_ROYAL_PLAYERS[Math.min(5, phaseIndex + (level % 4 === 0 ? 1 : 0))];
  const commonMeta = {
    opponent,
    season: phaseIndex + 1,
    week: ((level - 1) % 20) + 1,
    rankingPoints: type === 'training' ? 15 : type === 'tournament' ? 160 : type === 'showdown' ? 100 : 50,
    coachingFocus: ['Stroke and pace', 'Position and patterns', 'Safety and escapes', 'Match consistency', 'Championship finishing'][phaseIndex],
    phase,
    phaseTitle: phaseDetail.title,
    phaseSummary: phaseDetail.summary,
    difficulty: getStageDifficulty(level),
    estimatedDurationMins: type === 'tournament' ? 15 : type === 'showdown' ? 9 : 6,
    entryRequirement:
      level === 1 ? 'Start your Career journey' : `Complete Stage ${String(level - 1).padStart(3, '0')}`
  }

  if (type === 'training') {
    const trainingTask = describeTrainingLevel(trainingLevel || 1)
    return {
      id: `career-stage-${String(level).padStart(3, '0')}`,
      level,
      ...commonMeta,
      title: trainingTask.title,
      type,
      icon: '🎯',
      objective: trainingTask.objective,
      detailBrief: 'Precision drill focused on cue-ball control and confidence building.',
      winCondition: 'Clear the guided drill objective in the allocated attempts.',
      reward: trainingTask.reward,
      rewardTpc: Number(trainingTask.rewardAmount) || reward.tpc,
      hasGift: reward.hasGift,
      giftThumbnail: reward.giftThumbnail,
      trainingLevel,
      players: null,
      eventType: 'task',
      roundTarget: 1,
      competitionLabel: 'Task Objective'
    }
  }

  const stageMetaByType = {
    friendly: {
      titleBase: FRIENDLY_TITLES[(level - 1) % FRIENDLY_TITLES.length],
      icon: '🤝',
      objective: `Beat ${opponent.name} in a club friendly and earn ranking points.`,
      detailBrief: 'Single fixture designed to test shot selection under moderate pressure.',
      winCondition: 'Reach the target score before your opponent.',
      players: null,
      eventType: 'match',
      roundTarget: 1,
      competitionLabel: 'Friendly Match'
    },
    league: {
      titleBase: 'League Fixture',
      icon: '🗓️',
      objective: `Beat ${opponent.name} in this week's league fixture.`,
      detailBrief: 'Season ladder match where consistency matters more than fast clears.',
      winCondition: 'Win the frame and avoid foul-heavy play.',
      players: null,
      eventType: 'league',
      roundTarget: 1,
      competitionLabel: 'League Round'
    },
    showdown: {
      titleBase: 'Rival Showdown',
      icon: '⚡',
      objective: `Defeat ${opponent.name} in the season's featured frame.`,
      detailBrief: 'Headliner duel with tighter miss tolerance and stronger rival AI.',
      winCondition: 'Win the frame with a legal finish.',
      players: 2,
      eventType: 'match',
      roundTarget: 1,
      competitionLabel: 'Showdown Match'
    },
    tournament: {
      titleBase: TOURNAMENT_TITLES[(level - 1) % TOURNAMENT_TITLES.length],
      icon: '🏆',
      objective: `Win a ${getTournamentPlayers(level)}-player bracket and secure promotion.`,
      detailBrief: 'Bracket run with progressive opponents and reduced comeback margin.',
      winCondition: 'Claim the final table to earn promotion and bonus crates.',
      players: getTournamentPlayers(level),
      eventType: TOURNAMENT_TITLES[(level - 1) % TOURNAMENT_TITLES.length].toLowerCase().includes('cup') ? 'cup' : 'tournament',
      roundTarget: getBracketRounds(getTournamentPlayers(level)),
      competitionLabel: TOURNAMENT_TITLES[(level - 1) % TOURNAMENT_TITLES.length].toLowerCase().includes('cup') ? 'Cup Bracket' : 'Tournament Bracket'
    }
  }

  const stageMeta = stageMetaByType[type] || stageMetaByType.friendly

  return {
    id: `career-stage-${String(level).padStart(3, '0')}`,
    level,
    ...commonMeta,
    title: type === 'tournament' ? `${stageMeta.titleBase} · Season ${phase}` : `${stageMeta.titleBase} · ${opponent.name}`,
    type,
    icon: stageMeta.icon,
    objective: stageMeta.objective,
    detailBrief: stageMeta.detailBrief,
    winCondition: stageMeta.winCondition,
    reward: reward.label,
    rewardTpc: reward.tpc,
    hasGift: reward.hasGift,
    giftThumbnail: reward.giftThumbnail,
    trainingLevel,
    players: stageMeta.players,
    eventType: stageMeta.eventType || (type === 'tournament' ? 'tournament' : 'match'),
    roundTarget: stageMeta.roundTarget || 1,
    competitionLabel: stageMeta.competitionLabel || 'Match Round'
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

export function getCareerAthlete(progress = loadCareerProgress()) {
  const completed = new Set(progress.completedStageIds || []);
  const earned = CAREER_STAGES.filter(stage => completed.has(stage.id));
  return {
    rankingPoints: earned.reduce((sum, stage) => sum + stage.rankingPoints, 0),
    titles: earned.filter(stage => stage.type === 'tournament').length,
    fixturesWon: earned.filter(stage => stage.type !== 'training').length,
    drillsPassed: earned.filter(stage => stage.type === 'training').length,
    rank: CAREER_PHASE_DETAILS[Math.min(4, Math.floor(earned.length / 20))].title
  };
}
