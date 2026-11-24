import { defineConfig } from 'vite';
export default defineConfig({
  publicDir: '.tirana-ci/public',
  build: { outDir: '.tirana-ci/dist', emptyOutDir: true,
    rollupOptions: { input: '.tirana-ci/standalone-preview.html' } }
});
