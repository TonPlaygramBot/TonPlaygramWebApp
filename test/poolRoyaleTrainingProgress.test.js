import { resolvePlayableTrainingLevel } from '../webapp/src/utils/poolRoyaleTrainingProgress.js';

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
