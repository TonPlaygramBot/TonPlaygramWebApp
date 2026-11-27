import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {KTX2Loader} from 'three/examples/jsm/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {loadCityAssetBytes} from './cityAssetBytes.mjs';

/** Original glTF scenes share one bounded codec pool per streaming owner. */
export class CityAssetLoader extends GLTFLoader {
  private draco = new DRACOLoader().setDecoderPath('/vendor/three/examples/jsm/libs/draco/gltf/').setWorkerLimit(1);
  private basis = new KTX2Loader().setTranscoderPath('/vendor/three/examples/jsm/libs/basis/').setWorkerLimit(1);
  constructor() {
    super();
    this.setDRACOLoader(this.draco);
    this.setMeshoptDecoder(MeshoptDecoder);
  }
  configure(renderer: T.WebGLRenderer) {
    this.basis.detectSupport(renderer);
    this.setKTX2Loader(this.basis);
  }
  override async loadAsync(url:string,onProgress?:(event:ProgressEvent)=>void) {
    // Keep GLTFLoader's ordinary path for JSON models and callers that need
    // incremental progress. GLBs share only compressed bytes across owners.
    if(!/\.glb(?:[?#]|$)/i.test(url)||onProgress)return super.loadAsync(url,onProgress);
    const resolved=new URL(this.path+url,typeof window==='undefined'?'http://localhost/':window.location.href);
    const bytes=await loadCityAssetBytes(resolved.href);
    return this.parseAsync(bytes,this.resourcePath||new URL('.',resolved).href);
  }
  dispose() { this.draco.dispose(); this.basis.dispose(); }
}

/** Improve oblique sampling without modifying authored glTF texture data.
 * The static city can opt into fewer taps on scalar PBR maps while keeping
 * facade colour and normal detail sharp; other streaming owners are unchanged. */
export function prepareCityAssetTextures(
  root: T.Object3D,
  maxAnisotropy = 1,
  { scalarMapLimit }: { scalarMapLimit?: number } = {},
) {
  const full = Math.max(1, Math.min(8, Number.isFinite(maxAnisotropy) ? maxAnisotropy : 1));
  const scalar = scalarMapLimit === undefined || !Number.isFinite(scalarMapLimit)
    ? full : Math.max(1, Math.min(full, scalarMapLimit));
  const bySource = new Map<T.Source, number>();
  const textures = new Set<T.Texture>();
  const materials = new Set<T.Material>();
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (materials.has(material)) continue;
      materials.add(material);
      for (const [slot, texture] of Object.entries(material)) {
        if (!(texture instanceof T.Texture)) continue;
        if (scalarMapLimit !== undefined && (
          texture.magFilter === T.NearestFilter ||
          (texture.minFilter !== T.NearestMipmapLinearFilter && texture.minFilter !== T.LinearMipmapLinearFilter) ||
          (!texture.generateMipmaps && texture.mipmaps.length < 2)
        )) continue;
        textures.add(texture);
        if (scalar === full) continue;
        const scalarSlot = slot === 'roughnessMap' || slot === 'metalnessMap' || slot === 'aoMap';
        // A texture or UV-transform clone shared with a visible-detail slot
        // takes the higher value to avoid a second GPU sampler/cache key.
        bySource.set(texture.source, Math.max(bySource.get(texture.source) ?? 1, scalarSlot ? scalar : full));
      }
    }
  });
  for (const texture of textures) {
    const anisotropy = bySource.get(texture.source) ?? full;
    if (texture.anisotropy === anisotropy) continue;
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
  }
}
