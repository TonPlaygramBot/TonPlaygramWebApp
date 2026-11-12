import type {WebGLRenderer} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {KTX2Loader} from 'three/examples/jsm/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** One codec pool per visual owner. Decoders are copied from the locked Three
 * package by the existing prebuild, so models never depend on a third-party CDN. */
export class HumanModelLoader extends GLTFLoader {
  private draco=new DRACOLoader().setDecoderPath('/vendor/three/examples/jsm/libs/draco/gltf/').setWorkerLimit(2);
  private basis=new KTX2Loader().setTranscoderPath('/vendor/three/examples/jsm/libs/basis/').setWorkerLimit(2);
  constructor(){super();this.setDRACOLoader(this.draco);this.setMeshoptDecoder(MeshoptDecoder);}
  configure(renderer:WebGLRenderer){this.basis.detectSupport(renderer);this.setKTX2Loader(this.basis);}
  dispose(){this.draco.dispose();this.basis.dispose();}
}
