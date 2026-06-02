import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repoUrl = 'https://github.com/KrishBharadwaj5678/Gunify.git';
const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const publicModelsDir = join(repoRoot, 'public', 'models');
const destinationDir = join(publicModelsDir, 'gunify');
const tempDir = join(tmpdir(), `tonplaygram-gunify-${Date.now()}`);
const requiredModels = ['AK47', 'KRSV', 'Mosin', 'SigSauer', 'Smith', 'Uzi'];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

try {
  mkdirSync(publicModelsDir, { recursive: true });
  mkdirSync(destinationDir, { recursive: true });
  rmSync(tempDir, { recursive: true, force: true });
  run('git', ['clone', '--depth', '1', repoUrl, tempDir]);

  requiredModels.forEach((modelName) => {
    const source = join(tempDir, 'models', modelName);
    if (!existsSync(source)) {
      throw new Error(`Gunify model folder missing: ${modelName}`);
    }
    const destination = join(destinationDir, modelName);
    rmSync(destination, { recursive: true, force: true });
    cpSync(source, destination, { recursive: true });
  });

  console.log(`Gunify weapon GLTF assets copied to ${destinationDir}`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
