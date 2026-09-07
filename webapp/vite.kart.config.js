import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));

// Same React/Three.js game as the app route, without app sign-in dependencies.
// Runtime assets are copied explicitly by the preview publisher.
export default defineConfig({
  root,
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'dist-kart',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./kart-royale.html', import.meta.url)),
      output: {
        manualChunks: { three: ['three'], react: ['react', 'react-dom'] }
      }
    }
  }
});
