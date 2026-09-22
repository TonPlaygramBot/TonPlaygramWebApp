import { defineConfig } from 'vitest/config';
export default defineConfig({ esbuild: { jsx: 'automatic' }, test: {
  environment: 'jsdom', include: ['src/social/**/*.test.{tsx,js}'],
  environmentOptions: { jsdom: { url: 'https://tonplaygram-bot.onrender.com/social-app/' } }
} });
