import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
const root=fileURLToPath(new URL('../',import.meta.url));
const payload=JSON.parse(execFileSync('python3',[path.join(root,'../tools/blender/preview_neighbourhood.py')],{maxBuffer:16000000}));
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';
import * as T from 'three';import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import Explorer from './src/games/tirana-neighbourhood/NeighbourhoodExplorer';
const payload=${JSON.stringify(payload)};
async function loader(name){
 const bytes=Uint8Array.from(atob(payload.assets[name]),c=>c.charCodeAt(0));
 const data=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 const view=new DataView(data),length=view.getUint32(12,true),gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,length)));
 const original=structuredClone(gltf),binary=new Uint8Array(data,28+length);
 for(const a of gltf.accessors){if(a.componentType!==5126)continue;const v=gltf.bufferViews[a.bufferView],count=a.count*({SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type]);for(let i=0;i<count;i++){const offset=28+length+(v.byteOffset||0)+(a.byteOffset||0)+i*4;view.setFloat32(offset,view.getInt32(offset,true)/100,true);}}
 // Geometry-only GLTF parsing avoids image loader network APIs entirely.
 for(const material of gltf.materials){delete material.normalTexture;delete material.occlusionTexture;delete material.emissiveTexture;if(material.pbrMetallicRoughness){delete material.pbrMetallicRoughness.baseColorTexture;delete material.pbrMetallicRoughness.metallicRoughnessTexture;}}
 delete gltf.images;delete gltf.textures;
 const json=new TextEncoder().encode(JSON.stringify(gltf)),padded=(json.length+3)&~3,result=new ArrayBuffer(28+padded+binary.length),header=new DataView(result),out=new Uint8Array(result);
 header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,result.byteLength,true);header.setUint32(12,padded,true);header.setUint32(16,0x4e4f534a,true);out.fill(32,20,20+padded);out.set(json,20);header.setUint32(20+padded,binary.length,true);header.setUint32(24+padded,0x004e4942,true);out.set(binary,28+padded);
 const model=await new GLTFLoader().parseAsync(result,'');
 const textures=new Map();
 async function texture(index,srgb){const key=index+':'+srgb;if(textures.has(key))return textures.get(key);const source=original.images[original.textures[index].source],image=new Image();image.src=payload.images[source.uri];await image.decode();const t=new T.Texture(image);t.flipY=false;t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.needsUpdate=true;textures.set(key,t);return t;}
 for(let i=0;i<original.materials.length;i++){const source=original.materials[i],material=await model.parser.getDependency('material',i),p=source.pbrMetallicRoughness||{};
  if(p.baseColorTexture)material.map=await texture(p.baseColorTexture.index,true);
  if(p.metallicRoughnessTexture){material.roughnessMap=await texture(p.metallicRoughnessTexture.index,false);material.metalnessMap=material.roughnessMap;}
  if(source.normalTexture){material.normalMap=await texture(source.normalTexture.index,false);material.normalScale.setScalar(source.normalTexture.scale??1);}
  material.needsUpdate=true;
 }
 return model.scene;
}
createRoot(document.getElementById('tirana-neighbourhood-preview')).render(React.createElement(Explorer,{loader}));`;
const built=await build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,write:false,minify:true,format:'esm',jsx:'automatic',target:'es2022',external:['react','react/*','react-dom/*','three','three/*'],plugins:[{name:'inline-css',setup(b){b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));}}]});
let fragment=await readFile(path.join(root,'scripts/tirana-neighbourhood-preview.fragment.html'),'utf8');
fragment=fragment.replace('/*__STYLE__*/',await readFile(path.join(root,'src/games/tirana-neighbourhood/neighbourhoodExplorer.css'),'utf8')).replace('/*__SCRIPT__*/',new TextDecoder().decode(built.outputFiles[0].contents));
if(Buffer.byteLength(fragment)>1000000)throw Error('Inline review exceeds 1 MB');
const target=process.argv[2]||'/workspace/tirana-ali-demi-models.html';await writeFile(target,fragment);console.log(target+' '+Buffer.byteLength(fragment)+' bytes');
