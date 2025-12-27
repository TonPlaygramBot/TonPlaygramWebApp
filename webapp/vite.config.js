import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    // splaytree package ships without the declared ESM entry; point to the UMD build so Vite can bundle polygon-clipping
    alias: {
      splaytree: path.resolve(__dirname, 'node_modules/splaytree/dist/splaytree.js')
    }
  },
  // SPA fallback for React Router
  server: {
    historyApiFallback: true
  }
});
