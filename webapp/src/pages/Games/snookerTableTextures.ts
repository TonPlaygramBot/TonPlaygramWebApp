import { Mesh, MeshStandardMaterial } from 'three';
import type { Object3D, Texture, WebGLRenderer } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

const TEXTURE_ROOT = '/assets/snooker-royal/mesxwi/4k/';
const SURFACES = new Map([
  ['Legs', 'legs'], ['Leg_holders', 'leg-holders'], ['cushion', 'cushion'],
  ['Baize', 'baize'], ['Pot_corner', 'corner-pocket'], ['Pot_middle', 'side-pocket']
]);
const MAPS = [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'metal-rough']] as const;
type TextureLoader = Pick<KTX2Loader, 'loadAsync' | 'dispose'>;

function tableMaterials(model: Object3D) {
  const materials = new Set<MeshStandardMaterial>();
  model.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const candidates = Array.isArray(node.material) ? node.material : [node.material];
    candidates.forEach(material => {
      if (material instanceof MeshStandardMaterial) materials.add(material);
    });
  });
  return materials;
}

export function sharpenSnookerTableTextures(model: Object3D, renderer: WebGLRenderer) {
  const anisotropy = Math.max(1, renderer.capabilities.getMaxAnisotropy());
  for (const material of tableMaterials(model)) {
    for (const [slot] of MAPS) {
      const texture = material[slot];
      if (!texture || texture.anisotropy === anisotropy) continue;
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    }
  }
}

/** Restore native source resolution independently of the chosen frame-rate preset. */
export function createSnookerTableTextureQuality(
  table: Object3D,
  renderer: WebGLRenderer,
  makeLoader: () => TextureLoader = () => new KTX2Loader()
    .setTranscoderPath('/vendor/three/examples/jsm/libs/basis/')
    .setWorkerLimit(2).detectSupport(renderer)
) {
  // These ETC1S textures include pocket alpha. Only upgrade when every map can
  // stay GPU-compressed, avoiding an uncompressed 4K allocation on older phones.
  const supported = renderer.capabilities.maxTextureSize >= 4096 && [
    'EXT_texture_compression_bptc', 'WEBGL_compressed_texture_etc',
    'WEBGL_compressed_texture_s3tc', 'WEBGL_compressed_texture_pvrtc',
    'WEBKIT_WEBGL_compressed_texture_pvrtc'
  ].some(extension => renderer.extensions.has(extension));
  let disposed = false;
  let restore: (() => void) | undefined;

  async function upgrade() {
    if (!supported || !await table.userData.ready || disposed) return false;
    const bindings = [...tableMaterials(table)].flatMap(material => {
      const surface = SURFACES.get(material.name);
      if (!surface) return [];
      return MAPS.flatMap(([slot, role]) => {
        const original = material[slot];
        return original ? [{ material, slot, original,
          metalness: slot === 'roughnessMap' && material.metalnessMap === original,
          url: `${TEXTURE_ROOT}${surface}-${role}.ktx2` }] : [];
      });
    });
    if (!bindings.length) return false;
    let loader: TextureLoader | undefined;
    const loaded = new Map<string, Texture>();
    try {
      loader = makeLoader();
      // Several meshes share each authored surface: load and dispose it once.
      const urls = [...new Set(bindings.map(binding => binding.url))];
      const results = await Promise.allSettled(urls.map(url => loader!.loadAsync(url)));
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') loaded.set(urls[index], result.value);
      });
      if (disposed || loaded.size !== urls.length) {
        loaded.forEach(texture => texture.dispose());
        if (!disposed) console.warn('Snooker Royal could not load all native 4K table textures.');
        return false;
      }
      function assign(binding: typeof bindings[number], texture: Texture) {
        binding.material[binding.slot] = texture;
        if (binding.metalness) binding.material.metalnessMap = texture;
        binding.material.needsUpdate = true;
      }
      bindings.forEach(binding => {
        const texture = loaded.get(binding.url)!;
        const original = binding.original;
        texture.colorSpace = original.colorSpace;
        texture.channel = original.channel;
        texture.wrapS = original.wrapS;
        texture.wrapT = original.wrapT;
        texture.offset.copy(original.offset);
        texture.repeat.copy(original.repeat);
        texture.center.copy(original.center);
        texture.rotation = original.rotation;
        texture.anisotropy = Math.max(1, renderer.capabilities.getMaxAnisotropy());
        texture.needsUpdate = true;
        assign(binding, texture);
      });
      table.userData.textureResolution = 4096;
      restore = () => {
        bindings.forEach(binding => assign(binding, binding.original));
        loaded.forEach(texture => texture.dispose());
        delete table.userData.textureResolution;
      };
      return true;
    } catch (error) {
      loaded.forEach(texture => texture.dispose());
      if (!disposed) console.warn('Snooker Royal could not load native 4K table textures.', error);
      return false;
    } finally {
      loader?.dispose();
    }
  }

  return {
    ready: upgrade(),
    dispose() {
      disposed = true;
      restore?.();
      restore = undefined;
    }
  };
}
