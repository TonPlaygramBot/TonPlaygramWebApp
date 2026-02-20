import {
  describeTrainingLevel,
  getPracticeLayout,
  getTrainingLayout,
  PRACTICE_OBJECT_BALL_COUNT,
  resolvePlayableTrainingLevel
} from '../webapp/src/utils/poolRoyaleTrainingProgress.js';

describe('resolvePlayableTrainingLevel', () => {
  test('caps requested levels to the next incomplete slot', () => {
    const progress = { completed: [1, 2], lastLevel: 2 };
    expect(resolvePlayableTrainingLevel(5, progress)).toBe(3);
  });

  test('allows replaying unlocked levels without rewinding progress', () => {
    const progress = { completed: [1, 2, 3], lastLevel: 3 };
    expect(resolvePlayableTrainingLevel(2, progress)).toBe(2);
  });

  test('falls back to the last level when every task is already complete', () => {
    const progress = { completed: Array.from({ length: 50 }, (_, i) => i + 1), lastLevel: 4 };
    expect(resolvePlayableTrainingLevel(null, progress)).toBe(4);
  });
});

describe('pool royale practice layout', () => {
  test('uses a full 15-ball rack without roadmap task scaling', () => {
    const layout = getPracticeLayout();
    expect(Array.isArray(layout.balls)).toBe(true);
    expect(layout.balls.length).toBe(PRACTICE_OBJECT_BALL_COUNT);
  });
});

describe('pool royale training layout progression', () => {
  test('increases object-ball count by one from task 1 to task 25', () => {
    for (let level = 1; level <= 25; level++) {
      const layout = getTrainingLayout(level);
      expect(Array.isArray(layout.balls)).toBe(true);
      expect(layout.balls.length).toBe(level);
    }
  });

  test('keeps 25 object balls from task 26 to task 50', () => {
    for (let level = 26; level <= 50; level++) {
      const layout = getTrainingLayout(level);
      expect(layout.balls.length).toBe(25);
    }
  });

  test('does not repeat the same exact rack between early consecutive tasks', () => {
    const level1 = describeTrainingLevel(1).layout.balls;
    const level2 = describeTrainingLevel(2).layout.balls;
    expect(level1).not.toEqual(level2);
  });

  test('keeps early training balls away from pocket-edge dead zones', () => {
    for (let level = 1; level <= 12; level++) {
      const layout = getTrainingLayout(level);
      layout.balls.forEach((ball) => {
        expect(Math.abs(ball.x)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(ball.z)).toBeLessThanOrEqual(0.31);
        const nearCornerPocket = Math.abs(ball.x) > 0.44 && Math.abs(ball.z) > 0.24;
        expect(nearCornerPocket).toBe(false);
      });
    }
  });
});
