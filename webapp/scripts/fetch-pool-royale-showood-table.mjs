import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webappRoot = join(__dirname, '..');
const target = join(
  webappRoot,
  'public/models/pool-royale/showood-seven-foot/seven_foot_showood.glb'
);
const source =
  'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb';

const response = await fetch(source);
if (!response.ok) {
  throw new Error(`Download failed with HTTP ${response.status}`);
}

const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.byteLength < 100_000) {
  throw new Error(
    `Downloaded Showood GLB is unexpectedly small (${bytes.byteLength} bytes).`
  );
}

await mkdir(dirname(target), { recursive: true });
await rm(target, { force: true });
await writeFile(target, bytes);
console.log(
  `Installed Showood 7 ft GLB (${bytes.byteLength} bytes) at ${target}`
);
