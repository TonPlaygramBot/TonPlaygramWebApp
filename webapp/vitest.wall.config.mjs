import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['src/features/flamingo/**/*.test.tsx'],
    environmentOptions: {
      jsdom: { url: 'https://tonplaygram-bot.onrender.com/' }
    }
  }
});
