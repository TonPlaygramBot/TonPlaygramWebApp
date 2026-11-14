import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildSync} from '../webapp/node_modules/esbuild/lib/main.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

const temp = new URL('../webapp/node_modules/.cache/uniform-test/', import.meta.url);
mkdirSync(temp, {recursive:true});
buildSync({stdin:{contents:"export {prepareForceUniform} from './forceUniformMaterials'; export {createForceLOD} from './forceLOD';",resolveDir:fileURLToPath(new URL('../webapp/src/games/tiranastreets/',import.meta.url)),loader:'ts'},outfile:fileURLToPath(new URL('uniforms.mjs',temp)),bundle:true,platform:'node',format:'esm',external:['three','three/*'],logLevel:'silent'});
const {prepareForceUniform, createForceLOD} = await import(new URL('uniforms.mjs',temp));
const originalBitmap=globalThis.createImageBitmap, originalSelf=globalThis.self;
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
test.after(()=>{globalThis.createImageBitmap=originalBitmap;globalThis.self=originalSelf;rmSync(temp,{recursive:true,force:true});});

async function load(id) {
  const bytes=readFileSync(new URL(`../webapp/public/assets/tirana-streets/albanian-forces/glb/${id}.glb`,import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
function dispose(gltf) {
  const materials=new Set(),geometries=new Set(),textures=new Set();
  gltf.scene.traverse(mesh=>{if(mesh.isMesh){geometries.add(mesh.geometry);for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(m);}});
  for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}
  for(const t of textures)t.dispose();for(const g of geometries)g.dispose();
}

test('original Shqiponja shin bands become navy while red upper panels, rig and cloth maps survive both LODs',async()=>{
  const gltf=await load('shqiponja_officer');let red,navy,silver;
  gltf.scene.traverse(mesh=>{if(mesh.isMesh){if(mesh.material.name==='Shqiponjat red fabric')red=mesh;if(mesh.material.name==='Woven navy uniform')navy=mesh;if(mesh.material.name==='Reflective marking')silver=mesh;}});
  assert.ok(red&&navy&&silver);
  const source={position:red.geometry.attributes.position,index:red.geometry.index,uv:red.geometry.attributes.uv,skin:red.geometry.attributes.skinWeight,skeleton:red.skeleton,red:red.material.color.clone(),normal:red.material.normalMap,roughness:red.material.roughnessMap,animations:gltf.animations};
  let lod;
  try {
    prepareForceUniform(gltf.scene,'shqiponja_officer');
    const colors=red.geometry.attributes.color;assert.ok(colors);
    let lower=0,upper=0;
    for(let i=0;i<source.position.count;i++){
      const isLower=source.position.getY(i)<.8,expected=isLower?navy.material.color:source.red;
      if(isLower)lower++;else upper++;
      assert.ok(Math.abs(colors.getX(i)-expected.r)<1e-7&&Math.abs(colors.getY(i)-expected.g)<1e-7&&Math.abs(colors.getZ(i)-expected.b)<1e-7);
    }
    assert.ok(lower>0&&upper>0,'checks both the shin bands and the retained red upper garment');
    assert.equal(red.geometry.attributes.position,source.position);assert.equal(red.geometry.index,source.index);
    assert.equal(red.geometry.attributes.uv,source.uv);assert.equal(red.geometry.attributes.skinWeight,source.skin);assert.equal(red.skeleton,source.skeleton);
    assert.equal(red.material.normalMap,source.normal);assert.equal(red.material.roughnessMap,source.roughness);assert.equal(gltf.animations,source.animations);
    assert.ok(silver.material.color.equals(navy.material.color));assert.equal(silver.material.normalMap,navy.material.normalMap);assert.equal(silver.material.metalness,0);
    const patch=JSON.parse(readFileSync(new URL('../webapp/public/assets/tirana-streets/albanian-forces/lod/shqiponja_officer.json',import.meta.url)));
    lod=createForceLOD(gltf,patch);
    assert.equal(lod.get(red.geometry).attributes.color,colors,'LOD inherits exactly the corrected rest-pose colour attribute');
    prepareForceUniform(gltf.scene,'shqiponja_officer');assert.equal(red.geometry.attributes.color,colors,'preparation is idempotent');
  } finally {lod?.forEach(geometry=>geometry.dispose());dispose(gltf);}
});

test('all three unit label strips render as matte fabric, leaving their names and equipment geometry intact',async()=>{
  for(const id of ['shqiponja_officer','fnsh_officer','renea_officer']){
    const gltf=await load(id);const before=new Map();let labels=0;
    gltf.scene.traverse(mesh=>{if(mesh.isMesh)before.set(mesh,mesh.geometry);});
    try{
      prepareForceUniform(gltf.scene,id);
      gltf.scene.traverse(mesh=>{if(mesh.isMesh){assert.equal(mesh.geometry,before.get(mesh));if(mesh.material.name==='Pearl white paint'){labels++;assert.equal(mesh.material.metalness,0);assert.equal(mesh.material.roughness,.9);}if(mesh.material.name==='Graphite'){assert.equal(mesh.material.metalness,0);assert.equal(mesh.material.roughness,.88);}}});
      assert.ok(labels>0,`${id} has its original lettering`);
    }finally{dispose(gltf);}
  }
});
