import {
  CAREER_STAGES,
  getCareerRoadmap,
  getNextCareerStage,
  syncCareerProgressWithTraining
} from '../webapp/src/utils/poolRoyaleCareerProgress.js'

describe('pool royale career progression isolation', () => {
  test('does not auto-complete career training stages from standalone training progress', () => {
    const trainingProgress = { completed: [1, 2, 3, 4, 5] }
    const careerProgress = { completedStageIds: [], updatedAt: Date.now() }
    const synced = syncCareerProgressWithTraining(trainingProgress, careerProgress)
    expect(synced.completedStageIds).toEqual([])
  })

  test('roadmap only marks stages completed from career progress state', () => {
    const firstTrainingStage = CAREER_STAGES.find((stage) => stage.type === 'training')
    const roadmap = getCareerRoadmap({ completed: [firstTrainingStage.trainingLevel] }, {
      completedStageIds: [],
      updatedAt: Date.now()
    })
    const firstNode = roadmap.find((stage) => stage.id === firstTrainingStage.id)
    expect(firstNode.completed).toBe(false)
    expect(firstNode.playable).toBe(true)
  })

  test('next stage selection ignores standalone training completions', () => {
    const nextStage = getNextCareerStage(
      { completed: [1, 2, 3] },
      { completedStageIds: [], updatedAt: Date.now() }
    )
    expect(nextStage?.id).toBe(CAREER_STAGES[0].id)
  })

  test('career roadmap mixes drills, matches, and tournaments after onboarding', () => {
    const openingStages = CAREER_STAGES.slice(0, 20)
    const uniqueTypes = new Set(openingStages.map((stage) => stage.type))
    expect(uniqueTypes.has('training')).toBe(true)
    expect(uniqueTypes.has('friendly')).toBe(true)
    expect(uniqueTypes.has('tournament')).toBe(true)
    expect(uniqueTypes.has('league')).toBe(true)
    expect(uniqueTypes.has('showdown')).toBe(true)
    expect(openingStages[0].title).toContain('Task 01')
  })

  test('career training stages use training objectives and rewards', () => {
    const firstStage = CAREER_STAGES[0]
    expect(firstStage.objective).toContain('Clear')
    expect(firstStage.reward).toContain('TPC')
    expect(firstStage.rewardTpc).toBeGreaterThan(0)
  })

  test('gift milestones provide gift thumbnails for roadmap previews', () => {
    const giftStage = CAREER_STAGES.find((stage) => stage.hasGift)
    expect(giftStage).toBeTruthy()
    expect(giftStage.giftThumbnail).toContain('/store-thumbs/poolRoyale/tableFinish/')
  })


  test('career roadmap exposes section metadata for tasks, cups, tournaments, leagues, and matches', () => {
    const eventTypes = new Set(CAREER_STAGES.map((stage) => stage.eventType))
    expect(eventTypes.has('task')).toBe(true)
    expect(eventTypes.has('cup')).toBe(true)
    expect(eventTypes.has('tournament')).toBe(true)
    expect(eventTypes.has('league')).toBe(true)
    expect(eventTypes.has('match')).toBe(true)

    const cupStage = CAREER_STAGES.find((stage) => stage.eventType === 'cup')
    const tournamentStage = CAREER_STAGES.find((stage) => stage.eventType === 'tournament')
    expect(cupStage?.roundTarget).toBeGreaterThan(1)
    expect(tournamentStage?.roundTarget).toBeGreaterThan(1)
  })

})
