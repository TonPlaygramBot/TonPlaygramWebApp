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

/** Improve oblique road/facade sampling without recolouring original materials,
 * changing alpha cutouts, or treating packed PBR data as colour images. */
export function prepareCityAssetTextures(root: T.Object3D, maxAnisotropy = 1) {
  const anisotropy = Math.max(1, Math.min(8, Number.isFinite(maxAnisotropy) ? maxAnisotropy : 1));
  const textures = new Set<T.Texture>();
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
    }
  });
  for (const texture of textures) {
    if (texture.anisotropy === anisotropy) continue;
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
  }
}
