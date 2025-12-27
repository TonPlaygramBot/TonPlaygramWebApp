import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

const splaytreeEntry = fileURLToPath(
  new URL('./node_modules/splaytree/dist/splay.esm.js', import.meta.url)
);

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      splaytree: splaytreeEntry
    }
  },
  optimizeDeps: {
    include: ['splaytree']
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  // SPA fallback for React Router
  server: {
    historyApiFallback: true
  }
});
