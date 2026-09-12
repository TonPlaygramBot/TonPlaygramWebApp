import { defineConfig } from 'vitest/config';
export default defineConfig({ esbuild: { jsx: 'automatic' }, test: { environment: 'jsdom', include: ['src/**/*.snake.test.{js,jsx,ts}'] } });
