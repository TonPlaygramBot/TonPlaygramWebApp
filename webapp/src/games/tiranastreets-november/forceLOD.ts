import * as T from 'three';
import type {GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
type Patch={version:number;sourceSha256:string;primitives:{mesh:number;primitive:number;vertices:number;indices:string}[]};
export type ForceLOD=Map<T.BufferGeometry,T.BufferGeometry>;
/** Only index buffers differ. PBR maps, skin weights, normals, UVs, rig nodes,
 * animation mixers and vertex attributes stay shared with the original model. */
export function createForceLOD(gltf:GLTF,patch:Patch):ForceLOD{
 if(patch.version!==1||!Array.isArray(patch.primitives))throw Error('Unsupported force LOD');
 const entries=new Map(patch.primitives.map(p=>[`${p.mesh}/${p.primitive}`,p])),seen=new Set<string>(),result:ForceLOD=new Map();
 try{
  gltf.scene.traverse(object=>{
   if(!(object instanceof T.Mesh))return;
   const association=gltf.parser.associations.get(object) as {meshes?:number;primitives?:number}|undefined,key=`${association?.meshes}/${association?.primitives}`,record=entries.get(key);
   if(!record)throw Error(`Unmapped force primitive: ${key}`);
   const original=object.geometry;
   if(record.vertices!==original.getAttribute('position').count||original.groups.length)throw Error('Force LOD does not match source geometry');
   seen.add(key);if(result.has(original))return;
   const binary=atob(record.indices);if(binary.length%12)throw Error('Invalid triangle buffer');
   const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer),indices=new Uint32Array(bytes.length/4);
   for(let i=0;i<indices.length;i++){indices[i]=view.getUint32(i*4,true);if(indices[i]>=record.vertices)throw Error('Force LOD vertex outside source');}
   const geometry=new T.BufferGeometry();
   for(const name of Object.keys(original.attributes))geometry.setAttribute(name,original.getAttribute(name));
   geometry.morphAttributes=original.morphAttributes;geometry.morphTargetsRelative=original.morphTargetsRelative;
   geometry.setIndex(new T.Uint32BufferAttribute(indices,1));geometry.boundingBox=original.boundingBox?.clone()||null;geometry.boundingSphere=original.boundingSphere?.clone()||null;
   result.set(original,geometry);
  });
  if(seen.size!==entries.size)throw Error('Incomplete force LOD');return result;
 }catch(error){for(const g of result.values())g.dispose();throw error;}
}
export function applyForceLOD(root:T.Object3D,lod:ForceLOD,enabled:boolean){
 const replacements=enabled?lod:new Map([...lod].map(([original,simplified])=>[simplified,original]));
 root.traverse(object=>{if(object instanceof T.Mesh){const geometry=replacements.get(object.geometry);if(geometry)object.geometry=geometry;}});
}
export async function loadForceLOD(gltf:GLTF,id:string,source:ArrayBuffer,signal:AbortSignal):Promise<ForceLOD|undefined>{
 if(!['fnsh_officer','shqiponja_officer'].includes(id))return undefined;
 const response=await fetch(`/assets/tirana-streets/albanian-forces/lod/${id}.json`,{signal});if(!response.ok)throw Error(`Force LOD HTTP ${response.status}`);
 const patch=await response.json() as Patch;
 const digest=await crypto.subtle.digest('SHA-256',source),hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==patch.sourceSha256)throw Error('Force LOD source fingerprint mismatch');
 return createForceLOD(gltf,patch);
}
