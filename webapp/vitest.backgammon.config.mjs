import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/games/backgammon/*.test.tsx'],
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false
  }
});
