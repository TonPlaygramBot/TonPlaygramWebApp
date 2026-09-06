// Optional offline asset-workflow helper; never run by the application/build.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
const target = process.argv[2];
if (!target)
  throw new Error(
    'Usage: node scripts/fetch-kart-royale-sources.mjs /path/to/source-cache'
  );
const manifest = JSON.parse(
  await readFile(new URL('./kart-royale-sources.json', import.meta.url), 'utf8')
);
const entries = [
  { ...manifest.kart, directory: '' },
  ...manifest.buildings.files.map((f) => ({ ...f, directory: 'city' })),
  ...manifest.asphalt.files.map((f) => ({ ...f, directory: '' }))
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
for (let i = 0; i < entries.length; i += 3) {
  await Promise.all(
    entries.slice(i, i + 3).map(async (file) => {
      const dir = join(resolve(target), file.directory);
      await mkdir(dir, { recursive: true });
      const path = join(dir, file.file);
      try {
        if (hash(await readFile(path)) === file.sha256) return;
      } catch {}
      const response = await fetch(file.url, {
        signal: AbortSignal.timeout(60000)
      });
      if (!response.ok)
        throw new Error(`${file.file}: HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== file.bytes || hash(bytes) !== file.sha256)
        throw new Error(`${file.file}: source checksum mismatch`);
      await writeFile(path, bytes);
      console.log(`Verified ${file.file}`);
    })
  );
}
