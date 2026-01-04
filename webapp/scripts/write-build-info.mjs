import { mkdir, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import pkg from '../package.json' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const pwaDir = resolve(__dirname, '../public/pwa');

const now = new Date().toISOString();
const envBuild =
  process.env.APP_BUILD ||
  process.env.GITHUB_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.CI_COMMIT_SHA ||
  null;
const fallbackBuild = `${pkg.version}-dev`;
const buildTag = (envBuild || fallbackBuild).replace(/[^a-zA-Z0-9._-]/g, '-');

const versionPayload = {
  build: buildTag,
  generatedAt: now
};

const buildInfoScript = `(() => {
  const scope = typeof self !== 'undefined' ? self : globalThis;
  scope.APP_BUILD = '${buildTag}';
  scope.APP_BUILD_GENERATED_AT = '${now}';
})();`;

async function main() {
  await mkdir(pwaDir, { recursive: true });
  await writeFile(resolve(pwaDir, 'version.json'), `${JSON.stringify(versionPayload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(pwaDir, 'build-info.js'), `${buildInfoScript}\n`, 'utf8');
  console.log(`Wrote build metadata for ${buildTag} at ${now}`);
}

main().catch(err => {
  console.error('Failed to write build metadata', err);
  process.exitCode = 1;
});
