// Node-only GLB loader for offline rig generation and asset regressions.
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import draco from 'draco3d';
const d=await draco.createDecoderModule({});
const adapter={preload(){},decodeDracoFile(buffer,onLoad,ids,types,_color,onError){try{
 const decoder=new d.Decoder(),db=new d.DecoderBuffer();db.Init(new Int8Array(buffer),buffer.byteLength);const mesh=new d.Mesh(),status=decoder.DecodeBufferToMesh(db,mesh);if(!status.ok())throw Error(status.error_msg());const geo=new T.BufferGeometry();
 for(const [name,id]of Object.entries(ids)){const attr=decoder.GetAttributeByUniqueId(mesh,id),values=new d.DracoFloat32Array();decoder.GetAttributeFloatForAllPoints(mesh,attr,values);const A=globalThis[types[name]],a=new A(mesh.num_points()*attr.num_components());for(let i=0;i<a.length;i++)a[i]=values.GetValue(i);geo.setAttribute(name,new T.BufferAttribute(a,attr.num_components()));d.destroy(values);}
 const indices=new Uint32Array(mesh.num_faces()*3),face=new d.DracoInt32Array();for(let i=0;i<mesh.num_faces();i++){decoder.GetFaceFromMesh(mesh,i,face);for(let j=0;j<3;j++)indices[i*3+j]=face.GetValue(j);}geo.setIndex(new T.BufferAttribute(indices,1));[face,mesh,db,decoder].forEach(o=>d.destroy(o));onLoad(geo);
}catch(e){onError(e);}}};
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
export async function load(path){const b=fs.readFileSync(path);return (await new GLTFLoader().setDRACOLoader(adapter).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'/')).scene;}
export {T};
