// Geometry/rig smoke check using the actual Three.js loader, without a browser or GPU.
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const base=new URL('../public/assets/tirana-streets/living/',import.meta.url);
const loader=new GLTFLoader();loader.register(()=>({name:'HEADLESS_TEXTURES',loadTexture:async()=>new THREE.Texture()}));
for(const name of ['human','shotgun','ak47','krsv','city-car','motorbike','q-pistol']){
 const file=await fs.readFile(new URL(name+'.glb',base)),gltf=await loader.parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'');
 const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3());
 if(!size.toArray().every(n=>Number.isFinite(n)&&n>0))throw Error(name+' invalid bounds');
 let meshes=0,skin=0;gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh)meshes++;if(o instanceof THREE.SkinnedMesh)skin++;});
 if(name==='human'){
  if(!gltf.scene.getObjectByName('mixamorigRightArm'))throw Error('Missing aim bone');
  const mixer=new THREE.AnimationMixer(gltf.scene);for(const clip of gltf.animations){mixer.stopAllAction();mixer.clipAction(clip).play();mixer.update(.25);gltf.scene.updateMatrixWorld(true);}
 }
 console.log(name,{size:size.toArray().map(n=>+n.toFixed(3)),meshes,skin,animations:gltf.animations.length});
}
