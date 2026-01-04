import { createWriteStream } from 'fs';
import { access, mkdir } from 'fs/promises';
import { dirname } from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const WRAPPER_PATH = fileURLToPath(new URL('../android/gradle/wrapper/gradle-wrapper.jar', import.meta.url));
const WRAPPER_URL = 'https://raw.githubusercontent.com/gradle/gradle/v8.2.1/gradle/wrapper/gradle-wrapper.jar';

async function downloadJar() {
  await mkdir(dirname(WRAPPER_PATH), { recursive: true });

  await new Promise((resolve, reject) => {
    const file = createWriteStream(WRAPPER_PATH);
    https
      .get(WRAPPER_URL, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Unable to download Gradle wrapper (status ${response.statusCode})`));
          response.resume();
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

async function ensureWrapper() {
  try {
    await access(WRAPPER_PATH);
    return;
  } catch {
    // continue to download
  }

  await downloadJar();
}

ensureWrapper().catch((error) => {
  console.warn('Gradle wrapper jar could not be downloaded automatically. Please download it manually if you need the Android build tools.');
  console.warn(error.message);
});
