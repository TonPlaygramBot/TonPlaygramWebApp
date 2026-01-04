import { mkdir, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputPath = path.join(projectRoot, 'public', 'tonplaygram-launcher.apk');

const launcherUrl = process.env.LAUNCHER_URL || process.env.VITE_LAUNCHER_URL;
const expectedSha = (process.env.LAUNCHER_SHA256 || '').trim().toLowerCase();

if (!launcherUrl) {
  console.error('Set LAUNCHER_URL (or VITE_LAUNCHER_URL) to the signed launcher APK before running this script.');
  process.exitCode = 1;
  process.exit();
}

async function main() {
  console.info(`Downloading launcher from ${launcherUrl}…`);
  const response = await fetch(launcherUrl);

  if (!response.ok) {
    throw new Error(`Failed to download launcher: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (expectedSha) {
    const hash = createHash('sha256').update(buffer).digest('hex');
    if (hash !== expectedSha) {
      throw new Error(`SHA-256 mismatch. Expected ${expectedSha} but got ${hash}`);
    }
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
  console.info(`Saved launcher to ${outputPath} (${sizeMb} MiB).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
