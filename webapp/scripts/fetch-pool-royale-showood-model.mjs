import { createWriteStream } from 'fs';
import { mkdir, readFile, rename, rm, stat } from 'fs/promises';
import { createHash } from 'crypto';
import { dirname } from 'path';
import https from 'https';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const MODEL_PATH = fileURLToPath(
  new URL('../public/assets/models/pool-royale/showood/seven_foot_showood.glb', import.meta.url)
);
const MODEL_TMP_PATH = `${MODEL_PATH}.tmp`;
const MODEL_URL =
  process.env.POOL_ROYALE_SHOWOOD_MODEL_URL ||
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb';
const EXPECTED_SHA256 = (process.env.POOL_ROYALE_SHOWOOD_MODEL_SHA256 || '').trim().toLowerCase();
const MIN_MODEL_BYTES = 1_000_000;

function formatError(error) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'code' in error) return String(error.code);
  return String(error);
}

async function isValidGlb(path) {
  try {
    const [{ size }, header] = await Promise.all([stat(path), readFile(path, { encoding: null })]);
    return (
      size > MIN_MODEL_BYTES &&
      header[0] === 0x67 &&
      header[1] === 0x6c &&
      header[2] === 0x54 &&
      header[3] === 0x46
    );
  } catch {
    return false;
  }
}

async function verifyHashIfConfigured(path) {
  if (!EXPECTED_SHA256) return;
  const buffer = await readFile(path);
  const actual = createHash('sha256').update(buffer).digest('hex');
  if (actual !== EXPECTED_SHA256) {
    throw new Error(`SHA-256 mismatch. Expected ${EXPECTED_SHA256} but got ${actual}`);
  }
}

async function downloadWithHttps() {
  await new Promise((resolve, reject) => {
    const file = createWriteStream(MODEL_TMP_PATH);
    https
      .get(MODEL_URL, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Unable to download Showood model (status ${response.statusCode})`));
          response.resume();
          return;
        }

        response.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

async function downloadWithCurl() {
  await new Promise((resolve, reject) => {
    const child = spawn('curl', [
      '--fail',
      '--location',
      '--silent',
      '--show-error',
      '--output',
      MODEL_TMP_PATH,
      MODEL_URL
    ]);

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`curl exited with status ${code ?? 'unknown'}`));
    });
    child.on('error', reject);
  });
}

async function downloadModel() {
  await mkdir(dirname(MODEL_PATH), { recursive: true });
  await rm(MODEL_TMP_PATH, { force: true });

  try {
    await downloadWithHttps();
  } catch (error) {
    console.warn(`Direct Showood model download failed (${formatError(error)}); retrying with curl.`);
    await rm(MODEL_TMP_PATH, { force: true });
    await downloadWithCurl();
  }

  if (!(await isValidGlb(MODEL_TMP_PATH))) {
    throw new Error('Downloaded Showood model is not a valid GLB or is unexpectedly small.');
  }
  await verifyHashIfConfigured(MODEL_TMP_PATH);
  await rename(MODEL_TMP_PATH, MODEL_PATH);
}

async function ensureModel() {
  if (await isValidGlb(MODEL_PATH)) {
    console.info(`Showood model already exists at ${MODEL_PATH}.`);
    return;
  }

  await downloadModel();
  const { size } = await stat(MODEL_PATH);
  console.info(`Saved Showood model to ${MODEL_PATH} (${(size / (1024 * 1024)).toFixed(2)} MiB).`);
}

ensureModel().catch(async (error) => {
  await rm(MODEL_TMP_PATH, { force: true });
  console.error('Showood model could not be downloaded. Pool Royale will fall back to the remote GLB at runtime.');
  console.error(formatError(error));
  process.exitCode = 1;
});
