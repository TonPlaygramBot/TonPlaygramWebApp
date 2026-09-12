import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateBuiltGamePacks } from './generate-game-pack-manifests.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webappRoot = join(__dirname, '..');
const viteBin = join(webappRoot, 'node_modules', 'vite', 'bin', 'vite.js');

// Production builds include every game and its Three.js scene. They now need
// more than Node's previous 1536 MB Render allowance during Vite's transform
// phase, so use the same 3 GB ceiling locally and in hosted CI builds.
const defaultLimitMb = 3072;
const requested = Number.parseInt(process.env.WEBAPP_BUILD_MAX_OLD_SPACE_SIZE ?? '', 10);
const memoryLimitMb = Number.isFinite(requested) && requested > 0 ? requested : defaultLimitMb;

console.log(`[build] Running Vite with max-old-space-size=${memoryLimitMb}MB`);

const child = spawn(process.execPath, [`--max-old-space-size=${memoryLimitMb}`, viteBin, 'build'], {
  cwd: webappRoot,
  stdio: 'inherit',
  env: process.env
});

child.on('exit', async (code, signal) => {
  if (signal) {
    console.error(`[build] Vite build terminated with signal ${signal}`);
    process.exit(1);
  }

  if (code === 0) {
    try {
      await generateBuiltGamePacks(join(webappRoot, 'dist'));
      console.log('[build] Versioned game downloads include executable runtime chunks.');
    } catch (error) {
      console.error('[build] Game download generation failed:', error);
      process.exit(1);
    }
  }
  process.exit(code ?? 1);
});
