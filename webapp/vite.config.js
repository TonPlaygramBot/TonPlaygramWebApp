import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'service-worker.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,mp3,json}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
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
    historyApiFallback: true
  }
});
