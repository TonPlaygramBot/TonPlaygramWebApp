import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/games/tabletop/Game.test.tsx'],
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1
  }
});
