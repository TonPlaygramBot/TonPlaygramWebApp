import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {prepareHumanMaterials} from '../webapp/src/games/tiranastreets/street-career/humanMaterials.mjs';
import {createBody} from '../webapp/src/games/tiranastreets/street-career/playerCore.mjs';

const webapp=fileURLToPath(new URL('../webapp/',import.meta.url));
const dir=await mkdtemp(join(webapp,'.human-quality-test-'));
after(()=>rm(dir,{recursive:true,force:true}));

test('human PBR preparation keeps source textures and normals immutable and owns its copies',()=>{
  const albedo=new T.Texture(),normal=new T.Texture(),roughness=new T.Texture();
  const skin=new T.MeshPhysicalMaterial({map:albedo,emissiveMap:albedo,normalMap:normal,metalness:.6,roughness:.1,clearcoat:1});
  skin.name='head_mat';
  const clothing=new T.MeshStandardMaterial({map:albedo,normalMap:normal,roughnessMap:roughness,metalness:.3});clothing.name='body_armor';
  const geometry=new T.BoxGeometry(),root=new T.Group();
  const first=new T.Mesh(geometry,[skin,clothing]),second=new T.Mesh(geometry,skin);root.add(first,second);
  const normals=Array.from(geometry.getAttribute('normal').array);
  let sourceDisposals=0,ownedMaterialDisposals=0,ownedTextureDisposals=0;
  for(const source of [skin,clothing,albedo,normal,roughness,geometry])source.addEventListener('dispose',()=>sourceDisposals++);
  const release=prepareHumanMaterials(root),prepared=first.material[0];
  prepared.addEventListener('dispose',()=>ownedMaterialDisposals++);
  prepared.map.addEventListener('dispose',()=>ownedTextureDisposals++);
  assert.notEqual(prepared,skin);assert.equal(second.material,prepared);
  assert.notEqual(prepared.map,albedo);assert.equal(prepared.map,prepared.emissiveMap);
  assert.equal(prepared.map,first.material[1].map,'shared color images stay shared per source');
  assert.equal(prepared.map.colorSpace,T.SRGBColorSpace);assert.equal(albedo.colorSpace,T.NoColorSpace);
  assert.notEqual(prepared.normalMap,normal);assert.equal(prepared.normalMap.source,normal.source);assert.equal(normal.colorSpace,T.NoColorSpace);
  assert.equal(prepared.normalMap,first.material[1].normalMap,'normal maps share one prepared view');
  assert.equal(first.material[1].roughnessMap.source,roughness.source);assert.equal(first.material[1].metalness,.3);
  assert.equal(prepared.metalness,0);assert.equal(prepared.roughness,.55);assert.equal(prepared.clearcoat,0);
  assert.equal(prepared.normalScale.x,.7);assert.equal(skin.normalScale.x,1);
  assert.deepEqual(Array.from(geometry.getAttribute('normal').array),normals);
  const liveInstances=new T.Scene(),actor=second.clone();liveInstances.add(actor);
  release(liveInstances);release(liveInstances);
  assert.equal(first.material[0],skin);assert.equal(second.material,skin);
  assert.equal(actor.material,skin,'live clones restore source before normal scene disposal');
  assert.equal(sourceDisposals,0);assert.equal(ownedMaterialDisposals,1);assert.equal(ownedTextureDisposals,1);
});

test('actual Agent 47 skin keeps glossy eyes and clothing separate from face treatment',async()=>{
  const data=await readFile(join(webapp,'public/assets/tirana-streets/players/agent-47.glb'));
  const loader=new GLTFLoader();loader.register(()=>({name:'HEADLESS_TEXTURES',loadTexture:async()=>new T.Texture()}));
  const gltf=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const before=new Map();gltf.scene.traverse(mesh=>{if(mesh.isMesh)for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])before.set(mat.name,mat);});
  const release=prepareHumanMaterials(gltf.scene),after=new Map();gltf.scene.traverse(mesh=>{if(mesh.isMesh)for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])after.set(mat.name,mat);});
  assert.equal(after.get('eyes_mat').roughness,before.get('eyes_mat').roughness);
  assert.equal(after.get('jacket_mat').roughness,before.get('jacket_mat').roughness);
  assert.equal(after.get('head_mat').metalness,0);
  assert.equal(after.get('head_mat').normalMap?.source,before.get('head_mat').normalMap?.source);
  release();
});

test('color and packed data views preserve alpha and UVs, respect hardware limits, and release once',()=>{
  const image=new T.Texture();image.colorSpace=T.SRGBColorSpace;image.anisotropy=16;
  image.offset.set(.1,.2);image.repeat.set(.5,.7);image.rotation=.25;image.flipY=false;
  const material=new T.MeshPhysicalMaterial({map:image,emissiveMap:image,roughnessMap:image,
    metalnessMap:image,aoMap:image,normalMap:image,transparent:true,opacity:.7,alphaTest:.4,
    side:T.DoubleSide,depthWrite:false});
  const root=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(),material);root.add(mesh);
  let sourceDisposed=0;image.addEventListener('dispose',()=>sourceDisposed++);
  const release=prepareHumanMaterials(root,{maxAnisotropy:2}),prepared=mesh.material;
  assert.equal(prepared.map,prepared.emissiveMap);
  assert.equal(prepared.roughnessMap,prepared.metalnessMap);
  assert.equal(prepared.roughnessMap,prepared.aoMap);
  assert.notEqual(prepared.map,prepared.roughnessMap);
  let viewDisposals=0;
  for(const view of [prepared.map,prepared.roughnessMap]){
    assert.equal(view.source,image.source);assert.equal(view.anisotropy,2);
    assert.deepEqual(view.offset,image.offset);assert.deepEqual(view.repeat,image.repeat);
    assert.equal(view.rotation,.25);assert.equal(view.flipY,false);
    view.addEventListener('dispose',()=>viewDisposals++);
  }
  assert.equal(prepared.map.colorSpace,T.SRGBColorSpace);
  assert.equal(prepared.roughnessMap.colorSpace,T.NoColorSpace);
  assert.equal(image.colorSpace,T.SRGBColorSpace);assert.equal(image.anisotropy,16);
  for(const field of ['transparent','opacity','alphaTest','side','depthWrite'])assert.equal(prepared[field],material[field]);
  release();release();assert.equal(viewDisposals,2);assert.equal(sourceDisposed,0);
  assert.equal(mesh.material,material);
  for(const [cap,expected] of [[64,8],[0,1],[NaN,4]]){
    const cleanup=prepareHumanMaterials(root,{maxAnisotropy:cap});
    assert.equal(mesh.material.map.anisotropy,expected);cleanup();
  }
});

test('actual Turi preserves the black uniform/emblem atlas and photographic face with linear PBR',async()=>{
  const data=await readFile(join(webapp,'public/assets/tirana-streets/players/turi.glb'));
  const loader=new GLTFLoader();loader.register(()=>({name:'HEADLESS_TEXTURES',loadTexture:async()=>new T.Texture()}));
  const gltf=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const materials=()=>{const result=new Map();gltf.scene.traverse(mesh=>{if(mesh.isMesh)
    for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])result.set(mat.name,mat);});return result;};
  const before=materials(),release=prepareHumanMaterials(gltf.scene,{maxAnisotropy:16}),prepared=materials();
  const uniform=prepared.get('model'),sourceUniform=before.get('model');
  assert.equal(uniform.map.source,sourceUniform.map.source,'original black clothing and UÇK image stays intact');
  assert.equal(uniform.map.anisotropy,8);assert.equal(uniform.map.colorSpace,T.SRGBColorSpace);
  assert.equal(uniform.metalness,sourceUniform.metalness,'mixed body atlas retains authored response');
  assert.equal(uniform.roughness,sourceUniform.roughness);assert.equal(uniform.side,sourceUniform.side);
  assert.equal(uniform.roughnessMap,uniform.metalnessMap,'packed channels remain shared');
  assert.equal(uniform.roughnessMap.colorSpace,T.NoColorSpace);
  const head=prepared.get('Turi multi-view head'),sourceHead=before.get('Turi multi-view head');
  assert.ok(head,'photographic head material exists');
  assert.equal(head.map.source,sourceHead.map.source);
  assert.equal(head.normalMap.source,sourceHead.normalMap.source);
  assert.deepEqual(head.normalScale,sourceHead.normalScale);assert.equal(head.normalScale.x,.34);assert.equal(head.metalness,0);
  release();
});
