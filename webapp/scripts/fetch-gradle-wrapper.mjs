import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { mkdir, readFile, rename, rm, stat } from 'fs/promises';
import { dirname } from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const WRAPPER_PATH = fileURLToPath(
  new URL('../android/gradle/wrapper/gradle-wrapper.jar', import.meta.url)
);
const WRAPPER_TMP_PATH = `${WRAPPER_PATH}.tmp`;
const WRAPPER_URL =
  'https://raw.githubusercontent.com/gradle/gradle/v8.2.1/gradle/wrapper/gradle-wrapper.jar';

async function hasValidWrapperJar() {
  try {
    const [{ size }, header] = await Promise.all([
      stat(WRAPPER_PATH),
      readFile(WRAPPER_PATH, { encoding: null })
    ]);
    return (
      size > 0 &&
      header[0] === 0x50 &&
      header[1] === 0x4b &&
      header[2] === 0x03 &&
      header[3] === 0x04
    );
  } catch {
    return false;
  }
}

function formatError(error) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'code' in error)
    return String(error.code);
  return String(error);
}

async function downloadWithHttps() {
  await new Promise((resolve, reject) => {
    const file = createWriteStream(WRAPPER_TMP_PATH);
    https
      .get(WRAPPER_URL, (response) => {
        if (response.statusCode !== 200) {
          reject(
            new Error(
              `Unable to download Gradle wrapper (status ${response.statusCode})`
            )
          );
          response.resume();
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
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
      WRAPPER_TMP_PATH,
      WRAPPER_URL
    ]);

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`curl exited with status ${code ?? 'unknown'}`));
    });
    child.on('error', reject);
  });
}

async function downloadJar() {
  await mkdir(dirname(WRAPPER_PATH), { recursive: true });
  await rm(WRAPPER_TMP_PATH, { force: true });

  try {
    await downloadWithHttps();
  } catch (error) {
    console.warn(
      `Direct Gradle wrapper download failed (${formatError(error)}); retrying with curl.`
    );
    await rm(WRAPPER_TMP_PATH, { force: true });
    await downloadWithCurl();
  }

  await rename(WRAPPER_TMP_PATH, WRAPPER_PATH);
}

async function ensureWrapper() {
  if (await hasValidWrapperJar()) return;

  await downloadJar();
}

ensureWrapper().catch(async (error) => {
  await rm(WRAPPER_TMP_PATH, { force: true });
  console.warn(
    'Gradle wrapper jar could not be downloaded automatically. Please download it manually if you need the Android build tools.'
  );
  console.warn(formatError(error));
});
