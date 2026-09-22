import { createHash } from 'node:crypto';
import { POOL_ROYALE_SHOWOOD_PROFILE } from '../src/config/poolRoyaleShowoodProfile.js';
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
  `https://cdn.jsdelivr.net/gh/ekiefl/pooltool@${POOL_ROYALE_SHOWOOD_PROFILE.sourceCommit}/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb`;

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

const digest = createHash('sha256').update(bytes).digest('hex');
if (digest !== POOL_ROYALE_SHOWOOD_PROFILE.sha256) {
  throw new Error('Showood asset does not match its measured collision profile.');
}

await mkdir(dirname(target), { recursive: true });
await rm(target, { force: true });
await writeFile(target, bytes);
console.log(
  `Installed Showood 7 ft GLB (${bytes.byteLength} bytes) at ${target}`
);
