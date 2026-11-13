import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Pinned source geometry/textures for the three authored residence glTF scenes.
 * The small scene JSON is committed; original binary resources go through the
 * same budget, integrity, offline verification and build gates as other assets.
 */
export async function collectResidentialInventory({ repoRoot }) {
  const filename = path.join(repoRoot, 'webapp/public/assets/tirana-streets/residential/sources.json');
  const manifest = JSON.parse(await readFile(filename, 'utf8'));
  if (manifest.license !== 'CC0-1.0' || !Array.isArray(manifest.runtimeFiles) || manifest.runtimeFiles.length !== 13) {
    throw new Error('Invalid reviewed residential asset manifest');
  }
  return manifest.runtimeFiles.map(file => {
    const url = new URL(file.url);
    if (url.protocol !== 'https:' || url.hostname !== 'dl.polyhaven.org' ||
        !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes <= 0) {
      throw new Error('Invalid reviewed residential source');
    }
    return { id: `tirana-residence:${file.path}`, kind: 'dependency', candidates: [file.url], essential: true,
      sources: ['public/assets/tirana-streets/residential/sources.json'] };
  });
}
