import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildNativeModel,NATIVE_MODEL_IDS,MATERIALS} from '../src/games/tirana-landmarks/nativeModels.mjs';

/** Write valid glTF 2.0 with embedded buffers. No textures or external URIs. */
export function encodeLandmarkGLB(data) {
  const chunks=[],views=[],accessors=[];
  let byteLength=0;
  const attribute=(values,kind)=>{
    const floats=new Float32Array(values),bytes=Buffer.from(floats.buffer), view=views.length;
    chunks.push(bytes);views.push({buffer:0,byteOffset:byteLength,byteLength:bytes.length,target:34962});byteLength+=bytes.length;
    const accessor={bufferView:view,componentType:5126,count:values.length/3,type:'VEC3'};
    if(kind==='position'){
      accessor.min=[0,1,2].map(k=>Math.min(...floats.filter((_,i)=>i%3===k)));
      accessor.max=[0,1,2].map(k=>Math.max(...floats.filter((_,i)=>i%3===k)));
    }
    accessors.push(accessor);return accessors.length-1;
  };
  const linear=n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4;
  const names=[...new Set(data.meshes.map(m=>m.material))];
  const materials=names.map(name=>{
    const m=MATERIALS[name],c=m.color;
    return {name,pbrMetallicRoughness:{baseColorFactor:[linear(((c>>16)&255)/255),linear(((c>>8)&255)/255),linear((c&255)/255),1],metallicFactor:m.metalness,roughnessFactor:m.roughness}};
  });
  const primitives=data.meshes.map(part=>({attributes:{POSITION:attribute(part.positions,'position'),NORMAL:attribute(part.normals,'normal')},material:names.indexOf(part.material),mode:4}));
  const json={asset:{version:'2.0',generator:'TonPlaygram original Tirana landmark mesh builder'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:`${data.id}:${data.lod}`,mesh:0}],meshes:[{primitives}],buffers:[{byteLength}],bufferViews:views,accessors,materials,extras:{provenance:'Original artist approximation, not a Google Earth or third-party scan',units:'metres',triangles:data.triangles}};
  const text=Buffer.from(JSON.stringify(json)), jsonChunk=Buffer.alloc(Math.ceil(text.length/4)*4,0x20);text.copy(jsonChunk);
  const binary=Buffer.concat(chunks), binChunk=Buffer.alloc(Math.ceil(binary.length/4)*4);binary.copy(binChunk);
  const total=12+8+jsonChunk.length+8+binChunk.length, out=Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(total,8);
  out.writeUInt32LE(jsonChunk.length,12);out.writeUInt32LE(0x4e4f534a,16);jsonChunk.copy(out,20);
  const next=20+jsonChunk.length;out.writeUInt32LE(binChunk.length,next);out.writeUInt32LE(0x004e4942,next+4);binChunk.copy(out,next+8);
  return out;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const dir=resolve(process.argv[2]||fileURLToPath(new URL('../public/assets/tirana-landmarks/',import.meta.url)));
  await mkdir(dir,{recursive:true});
  const records=[];
  for(const id of NATIVE_MODEL_IDS)for(const lod of ['near','far']){
    const data=buildNativeModel(id,lod),bytes=encodeLandmarkGLB(data),file=`${id}${lod==='far'?'-lod':''}.glb`;
    await writeFile(resolve(dir,file),bytes);
    records.push({id,lod,file,bytes:bytes.length,triangles:data.triangles,drawCalls:data.meshes.length,bounds:data.bounds,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  await writeFile(resolve(dir,'generated-manifest.json'),JSON.stringify({provenance:'Original approximate meshes; not source-catalogue downloads',models:records},null,2)+'\n');
  console.log(JSON.stringify(records,null,2));
}
