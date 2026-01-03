const GLTF_MANIFEST_PATH = '/pwa/gltf-manifest.json';

let gltfManifestPromise = null;

const normalizeManifest = (assets = []) =>
  Array.from(new Set(assets.filter(Boolean))).map((asset) => asset.trim());

export async function loadGltfManifest() {
  if (gltfManifestPromise) return gltfManifestPromise;

  gltfManifestPromise = (async () => {
    const response = await fetch(GLTF_MANIFEST_PATH, { cache: 'reload' });
    if (!response.ok) throw new Error('Unable to load GLTF manifest');

    const assets = await response.json();
    if (!Array.isArray(assets)) throw new Error('Invalid GLTF manifest format');

    return normalizeManifest(assets);
  })();

  gltfManifestPromise.catch(() => {
    gltfManifestPromise = null;
  });

  return gltfManifestPromise;
}

export { GLTF_MANIFEST_PATH };
