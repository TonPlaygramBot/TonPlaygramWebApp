import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const pwaDir = path.join(publicDir, 'pwa');
const srcConfigDir = path.join(projectRoot, 'src', 'config');

function resolveBuildId() {
  const explicit = process.env.APP_BUILD;
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    const commit = execSync('git rev-parse --short HEAD', {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim();
    if (commit) return commit;
  } catch {
    // ignore missing git metadata
  }
  return `local-${Date.now()}`;
}

async function ensureDirs() {
  await fs.mkdir(pwaDir, { recursive: true });
  await fs.mkdir(srcConfigDir, { recursive: true });
}

async function loadExistingVersion() {
  try {
    const raw = await fs.readFile(path.join(publicDir, 'version.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeVersionJson(buildId, generatedAt) {
  const payload = { build: buildId, generatedAt };
  const versionPath = path.join(publicDir, 'version.json');
  await fs.writeFile(versionPath, `${JSON.stringify(payload, null, 2)}\n`);
  return versionPath;
}

async function writeServiceWorkerMarker(buildId) {
  const markerPath = path.join(pwaDir, 'app-build.js');
  const contents = `self.__TONPLAYGRAM_APP_BUILD__ = ${JSON.stringify(buildId)};\n`;
  await fs.writeFile(markerPath, contents);
  return markerPath;
}

async function writeRuntimeConfig(buildId, generatedAt) {
  const configPath = path.join(srcConfigDir, 'buildInfo.js');
  const contents = `export const APP_BUILD = ${JSON.stringify(buildId)};\nexport const APP_BUILD_GENERATED_AT = ${JSON.stringify(generatedAt)};\n`;
  await fs.writeFile(configPath, contents);
  return configPath;
}

async function main() {
  const buildId = resolveBuildId();
  await ensureDirs();
  const existing = await loadExistingVersion();
  const generatedAt =
    existing?.build === buildId && existing.generatedAt
      ? existing.generatedAt
      : new Date().toISOString();

  const [versionPath, markerPath, configPath] = await Promise.all([
    writeVersionJson(buildId, generatedAt),
    writeServiceWorkerMarker(buildId),
    writeRuntimeConfig(buildId, generatedAt)
  ]);
  console.log(`Wrote build metadata (${buildId}) to:`);
  console.log(`- ${versionPath}`);
  console.log(`- ${markerPath}`);
  console.log(`- ${configPath}`);
}

main().catch(err => {
  console.error('Failed to write build metadata', err);
  process.exitCode = 1;
});
