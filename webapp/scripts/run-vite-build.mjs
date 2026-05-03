import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webappRoot = join(__dirname, '..');
const viteBin = join(webappRoot, 'node_modules', 'vite', 'bin', 'vite.js');

const isRender = Boolean(process.env.RENDER) || process.env.CI === 'true';
const defaultLimitMb = isRender ? 1536 : 3072;
const requested = Number.parseInt(process.env.WEBAPP_BUILD_MAX_OLD_SPACE_SIZE ?? '', 10);
const memoryLimitMb = Number.isFinite(requested) && requested > 0 ? requested : defaultLimitMb;

console.log(`[build] Running Vite with max-old-space-size=${memoryLimitMb}MB`);

const child = spawn(process.execPath, [`--max-old-space-size=${memoryLimitMb}`, viteBin, 'build'], {
  cwd: webappRoot,
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[build] Vite build terminated with signal ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
