import { defineConfig } from 'vitest/config';
export default defineConfig({ esbuild: { jsx: 'automatic' }, test: { environment: 'jsdom', include: ['src/features/creator/*.test.tsx'], environmentOptions: { jsdom: { url: 'https://studio.example/creator-studio' } } } });
