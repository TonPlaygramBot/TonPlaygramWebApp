import {
  CAREER_STAGES,
  getCareerRoadmap,
  getNextCareerStage,
  syncCareerProgressWithTraining
} from '../webapp/src/utils/poolRoyaleCareerProgress.js';

describe('pool royale career progression isolation', () => {
  test('does not auto-complete career training stages from standalone training progress', () => {
    const trainingProgress = { completed: [1, 2, 3, 4, 5] };
    const careerProgress = { completedStageIds: [], updatedAt: Date.now() };
    const synced = syncCareerProgressWithTraining(trainingProgress, careerProgress);
    expect(synced.completedStageIds).toEqual([]);
  });

  test('roadmap only marks stages completed from career progress state', () => {
    const firstTrainingStage = CAREER_STAGES.find((stage) => stage.type === 'training');
    const roadmap = getCareerRoadmap({ completed: [firstTrainingStage.trainingLevel] }, {
      completedStageIds: [],
      updatedAt: Date.now()
    });
    const firstNode = roadmap.find((stage) => stage.id === firstTrainingStage.id);
    expect(firstNode.completed).toBe(false);
    expect(firstNode.playable).toBe(true);
  });

  test('next stage selection ignores standalone training completions', () => {
    const nextStage = getNextCareerStage(
      { completed: [1, 2, 3] },
      { completedStageIds: [], updatedAt: Date.now() }
    );
    expect(nextStage?.id).toBe(CAREER_STAGES[0].id);
  });
});
