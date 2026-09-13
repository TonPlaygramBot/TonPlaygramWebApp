import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.video.test.jsx'],
    environmentOptions: { jsdom: { url: 'https://tonplaygram-bot.onrender.com/' } }
  }
});
