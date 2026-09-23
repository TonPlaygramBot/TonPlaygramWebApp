/** Index-only LODs: original PBR maps, skin weights, vertices and animation
 * tracks are shared unchanged. Requires the pinned meshoptimizer dev tool. */
import {MeshoptSimplifier} from 'meshoptimizer';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),base=resolve(root,'webapp/public/assets/tirana-streets/albanian-forces');
await MeshoptSimplifier.ready;await mkdir(resolve(base,'lod'),{recursive:true});
for(const id of ['fnsh_officer','shqiponja_officer']){
 const bytes=await readFile(resolve(base,'glb',id+'.glb')),jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonLength)),bin=bytes.subarray(28+jsonLength);
 const types={5121:['readUInt8',1],5123:['readUInt16LE',2],5125:['readUInt32LE',4],5126:['readFloatLE',4]},sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
 function readAccessor(index){const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView],[method,width]=types[a.componentType],size=sizes[a.type],stride=v.byteStride||size*width,values=new Float32Array(a.count*size);
  if(a.sparse)throw Error('Sparse accessor needs explicit expansion');
  for(let i=0;i<a.count;i++)for(let c=0;c<size;c++){let value=bin[method]((v.byteOffset||0)+(a.byteOffset||0)+i*stride+c*width);if(a.normalized)value/=a.componentType===5121?255:65535;values[i*size+c]=value;}return values;
 }
 const patch={version:1,sourceSha256:createHash('sha256').update(bytes).digest('hex'),originalTriangles:0,triangles:0,primitives:[]};
 for(const [meshIndex,mesh]of gltf.meshes.entries())for(const [primitiveIndex,primitive]of mesh.primitives.entries()){
  if(primitive.mode!==undefined&&primitive.mode!==4)throw Error('Expected triangles');
  const position=readAccessor(primitive.attributes.POSITION),count=position.length/3,indices=primitive.indices===undefined?Uint32Array.from({length:count},(_,i)=>i):Uint32Array.from(readAccessor(primitive.indices));
  const normal=primitive.attributes.NORMAL===undefined?null:readAccessor(primitive.attributes.NORMAL),uv=primitive.attributes.TEXCOORD_0===undefined?null:readAccessor(primitive.attributes.TEXCOORD_0),weights=primitive.attributes.WEIGHTS_0===undefined?null:readAccessor(primitive.attributes.WEIGHTS_0);
  const attributes=new Float32Array(count*9);for(let i=0;i<count;i++){for(let c=0;c<3;c++)attributes[i*9+c]=normal?.[i*3+c]||0;for(let c=0;c<2;c++)attributes[i*9+3+c]=uv?.[i*2+c]||0;for(let c=0;c<4;c++)attributes[i*9+5+c]=weights?.[i*4+c]||0;}
  const target=Math.max(12,Math.floor(indices.length*.22/3)*3);
  const [simplified,error]=MeshoptSimplifier.simplifyWithAttributes(indices,position,3,attributes,9,[.1,.1,.1,.2,.2,1,1,1,1],null,target,.012,['LockBorder','Regularize']);
  patch.originalTriangles+=indices.length/3;patch.triangles+=simplified.length/3;
  patch.primitives.push({mesh:meshIndex,primitive:primitiveIndex,vertices:count,error,indices:Buffer.from(simplified.buffer,simplified.byteOffset,simplified.byteLength).toString('base64')});
 }
 await writeFile(resolve(base,'lod',id+'.json'),JSON.stringify(patch)+'\n');console.log(id,{before:patch.originalTriangles,after:patch.triangles,reduction:1-patch.triangles/patch.originalTriangles});
}
