import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pruneNativeGamePacks } from './prune-native-game-packs.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEBAPP_DIR = path.resolve(SCRIPT_DIR, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: WEBAPP_DIR, stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}.`));
    });
  });

async function main() {
  const cdnBaseUrl = String(process.env.GAME_PACK_CDN_BASE_URL || '').trim();
  if (!/^https:\/\//i.test(cdnBaseUrl)) {
    throw new Error('GAME_PACK_CDN_BASE_URL must be an HTTPS URL for a core-only native build.');
  }

  await run(npmCommand, ['run', 'build'], {
    env: {
      ...process.env,
      GAME_PACK_CDN_BASE_URL: cdnBaseUrl,
      VITE_REQUIRE_GAME_PACKS: 'true'
    }
  });
  await pruneNativeGamePacks();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
