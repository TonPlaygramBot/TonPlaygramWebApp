import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.navigation.test.{js,jsx,ts}'],
    environmentOptions: { jsdom: { url: 'https://tonplaygram-bot.onrender.com/' } }
  }
});
