import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    // Ensure polygon-clipping can load its SplayTree dependency in Vite
    alias: {
      splaytree: 'splaytree/dist/splay.esm.js'
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
