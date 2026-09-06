import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      // splaytree package publishes dist/splaytree.js but points exports to a missing file
      splaytree: resolve(__dirname, 'node_modules/splaytree/dist/splaytree.js')
    }
  },
  optimizeDeps: {
    include: ['splaytree']
  },
  // SPA fallback for React Router
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local'],
    fs: { allow: [resolve(__dirname, '..')] },
    historyApiFallback: true
  }
});
