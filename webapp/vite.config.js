import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localizeExternalAssetPlugin } from './scripts/localize-external-assets.mjs';
import { copyPublicAssetsPlugin } from './scripts/copy-public-assets.mjs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [localizeExternalAssetPlugin(), react(), copyPublicAssetsPlugin()],
  build: {
    copyPublicDir: false,
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), cityUpdate: resolve(__dirname, 'tirana-city-update-review.html'), mobileReview: resolve(__dirname, 'tirana-mobile-review.html'), gameplayReview: resolve(__dirname, 'tirana-gameplay-review.html') } },
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
