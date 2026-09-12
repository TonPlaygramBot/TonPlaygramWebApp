import { describeTrainingLevel, getTrainingLayout, resolvePlayableTrainingLevel } from '../webapp/src/utils/poolRoyaleTrainingProgress.js';

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

describe('pool royale training layout progression', () => {
  test('teaches ten distinct skills across five progressively tighter tiers', () => {
    const skills = new Set();
    for (let level = 1; level <= 50; level++) {
      const drill = describeTrainingLevel(level);
      skills.add(drill.id);
      expect(drill.layout.balls.length).toBeGreaterThan(0);
      expect(drill.layout.balls.length).toBeLessThanOrEqual(3);
      expect(drill.shotLimit).toBeGreaterThanOrEqual(1);
      expect(drill.objective.length).toBeGreaterThan(20);
    }
    expect(skills.size).toBe(10);
    expect(describeTrainingLevel(42).zone.radius).toBeLessThan(describeTrainingLevel(2).zone.radius);
  });

  test('does not repeat the same exact rack between early consecutive tasks', () => {
    const level1 = describeTrainingLevel(1).layout.balls;
    const level2 = describeTrainingLevel(2).layout.balls;
    expect(level1).not.toEqual(level2);
  });

  test('keeps drills inside the playable area with unique rack IDs', () => {
    for (let level = 1; level <= 50; level++) {
      const layout = getTrainingLayout(level);
      expect(new Set(layout.balls.map(ball => ball.rackIndex)).size).toBe(layout.balls.length);
      [...layout.balls, layout.cue].forEach(ball => {
        expect(Math.abs(ball.x)).toBeLessThan(.8);
        expect(Math.abs(ball.z)).toBeLessThan(.8);
      });
    }
  });
});
