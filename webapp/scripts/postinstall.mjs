import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const shouldSkipHeavyTasks =
  process.env.RENDER === 'true' ||
  process.env.CI === 'true' ||
  process.env.SKIP_NATIVE_ASSET_GEN === 'true';

const tasks = shouldSkipHeavyTasks
  ? ['fetch:gradle-wrapper']
  : ['generate:native-assets', 'fetch:gradle-wrapper'];

function runNpmScript(scriptName) {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(cmd, ['run', scriptName], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(true);
        return;
      }
      console.warn(`[postinstall] Skipping failure in \"${scriptName}\" (exit ${code ?? 'unknown'}).`);
      resolve(false);
    });

    child.on('error', (error) => {
      console.warn(`[postinstall] Could not run \"${scriptName}\": ${error.message}`);
      resolve(false);
    });
  });
}

async function main() {
  if (shouldSkipHeavyTasks) {
    console.info('[postinstall] CI/Render mode detected. Skipping native asset generation.');
  }

  for (const task of tasks) {
    // Best-effort postinstall to keep cloud deploys from failing on optional tooling.
    // eslint-disable-next-line no-await-in-loop
    await runNpmScript(task);
  }
}

await main();
