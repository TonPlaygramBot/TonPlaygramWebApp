import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(
  new URL('../webapp/package.json', import.meta.url)
);
const { build } = require('esbuild');
const temp = await mkdtemp(join(tmpdir(), 'blackwater-verify-')),
  bundle = join(temp, 'engine.mjs');
try {
  await build({
    entryPoints: [join(root, 'webapp/src/games/blackwater/engine.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle
  });
  const child = spawn(
    process.execPath,
    [
      '--test',
      'test/blackwater.test.mjs',
      'test/blackwaterOnline.test.mjs',
      'test/blackwaterOperation.test.mjs',
      'test/blackwaterStake.test.mjs'
    ],
    {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        BLACKWATER_ENGINE_BUNDLE: pathToFileURL(bundle).href
      }
    }
  );
  process.exitCode = await new Promise((resolve) =>
    child.on('exit', (code) => resolve(code ?? 1))
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
