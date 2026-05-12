import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

const SHOWOOD_MODEL_URL =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb';
const OUTPUT_PATH = resolve(
  'public/assets/models/pool-royale/showood/seven_foot_showood.glb'
);
const MIN_EXPECTED_BYTES = 1_000_000;

async function downloadShowoodModel() {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });

  const response = await fetch(SHOWOOD_MODEL_URL);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download Showood model: ${response.status} ${response.statusText}`);
  }

  const temporaryPath = `${OUTPUT_PATH}.tmp`;
  await pipeline(response.body, createWriteStream(temporaryPath));

  const { size } = await stat(temporaryPath);
  if (size < MIN_EXPECTED_BYTES) {
    await rm(temporaryPath, { force: true });
    throw new Error(`Downloaded Showood model is unexpectedly small (${size} bytes)`);
  }

  await rm(OUTPUT_PATH, { force: true });
  await import('node:fs/promises').then(({ rename }) => rename(temporaryPath, OUTPUT_PATH));
  console.log(`Saved Showood model to ${OUTPUT_PATH} (${size} bytes)`);
}

downloadShowoodModel().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
