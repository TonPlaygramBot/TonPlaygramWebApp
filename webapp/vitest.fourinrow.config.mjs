import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.fourinrow.test.{js,jsx,ts}'],
    environmentOptions: { jsdom: { url: 'https://tonplaygram-bot.onrender.com/' } },
    restoreMocks: true
  }
});
