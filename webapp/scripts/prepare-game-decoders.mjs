import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WEBAPP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DECODER_FILES = [
  'draco/README.md',
  'draco/gltf/draco_decoder.js',
  'draco/gltf/draco_decoder.wasm',
  'draco/gltf/draco_wasm_wrapper.js',
  'basis/README.md',
  'basis/basis_transcoder.js',
  'basis/basis_transcoder.wasm'
];

// Use the same lockfile-pinned Three.js distribution as the game loaders. Both
// workers fetch their JS/WASM at runtime, outside Vite's module dependency graph.
export async function prepareGameDecoders({
  sourceDir = path.join(WEBAPP_DIR, 'node_modules/three/examples/jsm/libs'),
  outputDir = path.join(WEBAPP_DIR, 'public/vendor/three/examples/jsm/libs')
} = {}) {
  const assets = await Promise.all(DECODER_FILES.map(async relativePath => {
    let bytes;
    try {
      bytes = await readFile(path.join(sourceDir, relativePath));
    } catch (error) {
      throw new Error(`Missing Three.js decoder dependency ${relativePath}. Run npm ci before building.`, { cause: error });
    }
    if (!bytes.length || relativePath.endsWith('.wasm') && !bytes.subarray(0, 4).equals(Buffer.from([0, 97, 115, 109]))) {
      throw new Error(`Invalid Three.js decoder dependency: ${relativePath}`);
    }
    return { relativePath, bytes };
  }));

  // Validate every source before writing so a broken installation fails early.
  for (const { relativePath, bytes } of assets) {
    const destination = path.join(outputDir, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
  return { files: assets.length, totalBytes: assets.reduce((total, asset) => total + asset.bytes.length, 0) };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  prepareGameDecoders().then(({ files, totalBytes }) => {
    console.log(`Bundled ${files} local Draco/Basis files (${totalBytes.toLocaleString()} bytes).`);
  }).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
