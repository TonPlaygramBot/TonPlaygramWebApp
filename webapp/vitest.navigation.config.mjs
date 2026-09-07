import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.navigation.test.{js,jsx,ts}'],
    environmentOptions: { jsdom: { url: 'https://tonplaygram-bot.onrender.com/' } }
  }
});
