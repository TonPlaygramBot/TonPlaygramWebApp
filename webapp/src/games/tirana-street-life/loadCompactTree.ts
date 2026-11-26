import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Optional transport only. Keep the original glTF on hosts/devices where
 * the compact asset or decoder is unavailable; do not request both normally. */
export async function loadCompactTree(originalPath:string){
 const loader=new GLTFLoader();
 try{
  const {MeshoptDecoder}=await import('three/examples/jsm/libs/meshopt_decoder.module.js');
  if(!MeshoptDecoder.supported)throw new Error('Meshopt unavailable');
  await MeshoptDecoder.ready;
  loader.setMeshoptDecoder(MeshoptDecoder);
  const compactPath=originalPath.replace(/\.glb$/,'-compact.glb');
  return (await loader.loadAsync(compactPath)).scene;
 }catch{
  return (await loader.loadAsync(originalPath)).scene;
 }
}
