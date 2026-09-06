import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { cpSync, renameSync } from 'node:fs';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root,
  plugins: [
    react(),
    {
      name: 'bowling-static-preview',
      closeBundle() {
        renameSync(
          `${root}dist-bowling-preview/bowling-preview.html`,
          `${root}dist-bowling-preview/index.html`
        );
        cpSync(
          `${root}public/assets/bowling-royal`,
          `${root}dist-bowling-preview/assets/bowling-royal`,
          { recursive: true }
        );
      }
    }
  ],
  publicDir: false,
  build: {
    outDir: 'dist-bowling-preview',
    emptyOutDir: true,
    rollupOptions: { input: `${root}bowling-preview.html` }
  }
});
