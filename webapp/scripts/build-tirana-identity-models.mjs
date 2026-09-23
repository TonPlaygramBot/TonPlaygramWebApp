/** Bake real runtime geometry to portable glTF before deployment. No browser,
 * canvas, network or Blender dependency. The Blender recipe imports these GLBs. */
import {build} from 'esbuild';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const temporary=await mkdtemp(join(tmpdir(),'tirana-identity-'));
const output=resolve(root,'webapp/public/assets/tirana-streets/city-identity');
await mkdir(output,{recursive:true});
try{
 const module=join(temporary,'geometry.mjs');
 await build({stdin:{contents:`export * as T from 'three'; export {identityReliefFromImage,RELIEF_BRANDS} from './src/games/tirana-street-life/IdentityRelief'; export {SIGN_REFERENCES} from './src/games/tirana-street-life/signReferences.mjs'; export {UrbanMonumentLayer} from './src/games/tirana-landmarks/UrbanMonumentLayer'; export {parliamentPalms} from './src/games/tirana-city-source/ParliamentPalms';`,resolveDir:join(root,'webapp'),loader:'ts'},outfile:module,bundle:true,platform:'node',format:'esm'});
 const api=await import(pathToFileURL(module));
 const manifest={version:1,coordinateSystem:'glTF Y-up, metres',method:'Authored geometry; original operator artwork',models:{}};
 async function writeModel(id,group,textureFile,extras={}){
  const chunks=[],bufferViews=[],accessors=[],materials=[],meshes=[],nodes=[],materialIndex=new Map();let length=0;
  const append=(buffer,target)=>{const padded=Buffer.alloc(Math.ceil(buffer.byteLength/4)*4);Buffer.from(buffer).copy(padded);const index=bufferViews.length;bufferViews.push({buffer:0,byteOffset:length,byteLength:buffer.byteLength,...(target?{target}:{})});chunks.push(padded);length+=padded.length;return index;};
  const attribute=(a,semantic)=>{const array=new Float32Array(a.array),view=append(Buffer.from(array.buffer),34962),index=accessors.length;
   const entry={bufferView:view,componentType:5126,count:a.count,type:a.itemSize===2?'VEC2':'VEC3'};
   if(semantic==='POSITION'){entry.min=[Infinity,Infinity,Infinity];entry.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.count;i++)for(let c=0;c<3;c++){entry.min[c]=Math.min(entry.min[c],array[i*3+c]);entry.max[c]=Math.max(entry.max[c],array[i*3+c]);}}
   accessors.push(entry);return index;
  };
  group.updateMatrixWorld(true);let triangles=0;
  group.traverse(mesh=>{if(!mesh.isMesh)return;
   const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),geometry=g.index?g.toNonIndexed():g;
   if(g!==geometry)g.dispose();
   const mat=mesh.material;if(Array.isArray(mat))throw Error('Split material groups before export');
   let mi=materialIndex.get(mat);
   if(mi===undefined){mi=materials.length;materialIndex.set(mat,mi);const c=mat.color||new api.T.Color(1,1,1);
    materials.push({name:mat.name||mesh.name||`material-${mi}`,pbrMetallicRoughness:{baseColorFactor:[c.r,c.g,c.b,mat.opacity??1],metallicFactor:mat.metalness??0,roughnessFactor:mat.roughness??1,...(mat.map?{baseColorTexture:{index:0}}:{})},doubleSided:mat.side===api.T.DoubleSide,...(mat.alphaTest?{alphaMode:'MASK',alphaCutoff:mat.alphaTest}:{})});
   }
   const attributes={};for(const [name,semantic] of [['position','POSITION'],['normal','NORMAL'],['uv','TEXCOORD_0'],['color','COLOR_0']]){
    const a=geometry.getAttribute(name);if(!a)continue;if(name==='uv'&&mat.map?.flipY)for(let i=0;i<a.count;i++)a.setY(i,1-a.getY(i));attributes[semantic]=attribute(a,semantic);
   }
   triangles+=geometry.getAttribute('position').count/3;nodes.push({name:mesh.name||`part-${nodes.length}`,mesh:meshes.length});meshes.push({primitives:[{attributes,material:mi,mode:4}]});geometry.dispose();
  });
  const image=textureFile?await readFile(textureFile):null;
  const imageView=image?append(image):null;
  const document={asset:{version:'2.0',generator:'Tirana authored identity baker'},scene:0,scenes:[{name:id,nodes:nodes.map((_,i)=>i),extras}],nodes,meshes,materials,accessors,bufferViews,buffers:[{byteLength:length}],...(image?{images:[{bufferView:imageView,mimeType:'image/png'}],textures:[{source:0,sampler:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}]}:{})};
  const json=Buffer.from(JSON.stringify(document)),jsonChunk=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(jsonChunk);
  const bin=Buffer.concat(chunks),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(20+jsonChunk.length+8+bin.length,8);header.writeUInt32LE(jsonChunk.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(bin.length);binHeader.writeUInt32LE(0x004e4942,4);
  const bytes=Buffer.concat([header,jsonChunk,binHeader,bin]);await writeFile(join(output,id+'.glb'),bytes);
  manifest.models[id]={file:id+'.glb',bytes:bytes.length,triangles,drawCalls:meshes.length,...extras};
  group.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.map?.dispose();o.material.dispose();}});
 }
 for(const id of api.RELIEF_BRANDS){const reference=api.SIGN_REFERENCES.find(s=>s.id===id);await writeModel(id,api.identityReliefFromImage(id,{}),resolve(root,'webapp/public'+reference.logo),{source:reference.source,kind:'operator-sign'});}
 await writeModel('parliament-palms',api.parliamentPalms(),null,{kind:'entrance-landscaping',source:'Packaged city-parliament.jpg; authored dimensions'});
 const monuments=new api.UrbanMonumentLayer();
 for(const monument of monuments.group.children){const source=monument.userData;monument.position.set(0,0,0);monument.rotation.set(0,0,0);await writeModel('monument-'+source.id,monument,null,{kind:'monument',source:source.source,accuracy:source.accuracy});}
 await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await writeFile(resolve(root,'webapp/src/games/tirana-street-life/identityReliefManifest.mjs'),'/** Generated by build-tirana-identity-models.mjs. */\nexport const RELIEF_BRANDS = new Set('+JSON.stringify([...api.RELIEF_BRANDS])+');\n');
 console.log(JSON.stringify({models:Object.keys(manifest.models).length,totalBytes:Object.values(manifest.models).reduce((s,m)=>s+m.bytes,0),maxSignDrawCalls:Math.max(...Object.values(manifest.models).filter(m=>m.kind==='operator-sign').map(m=>m.drawCalls))}));
}finally{await rm(temporary,{recursive:true,force:true});}
