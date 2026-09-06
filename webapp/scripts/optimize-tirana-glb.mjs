// Compact static geometry after texture embedding. Keeps node hierarchy and animations.
import {readFile,writeFile} from 'node:fs/promises';
import {MeshoptSimplifier} from 'meshoptimizer';
await MeshoptSimplifier.ready;
const [path, budget='26000']=process.argv.slice(2),data=await readFile(path);
const jsonSize=data.readUInt32LE(12),doc=JSON.parse(data.subarray(20,20+jsonSize)),bin=data.subarray(28+jsonSize);
const views=doc.bufferViews.map(v=>Buffer.from(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)));
const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},constructors={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
function read(index){const a=doc.accessors[index];if(a.sparse)throw Error('Sparse accessor requires a separate optimizer');const C=constructors[a.componentType],count=components[a.type],v=doc.bufferViews[a.bufferView],out=new C(a.count*count),bytes=C.BYTES_PER_ELEMENT,src=views[a.bufferView];for(let i=0;i<a.count;i++){const offset=(a.byteOffset||0)+i*(v.byteStride||count*bytes);const chunk=src.subarray(offset,offset+count*bytes);new Uint8Array(out.buffer,i*count*bytes,count*bytes).set(chunk);}return out;}
function add(data,original){const a={...original,bufferView:views.length,byteOffset:0,count:data.length/components[original.type]};delete a.min;delete a.max;if(a.type==='VEC3'&&a.componentType===5126){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<data.length;i++){a.min[i%3]=Math.min(a.min[i%3],data[i]);a.max[i%3]=Math.max(a.max[i%3],data[i]);}}
 views.push(Buffer.from(data.buffer,data.byteOffset,data.byteLength));doc.bufferViews.push({buffer:0,byteLength:data.byteLength});doc.accessors.push(a);return doc.accessors.length-1;}
const total=doc.meshes.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+(p.indices!==undefined?doc.accessors[p.indices].count:doc.accessors[p.attributes.POSITION].count)/3,0),0),ratio=Math.min(1,Number(budget)/total);let after=0;
for(const mesh of doc.meshes)for(const p of mesh.primitives){if(p.targets||p.mode&&p.mode!==4)continue;const positions=read(p.attributes.POSITION);let indices=p.indices!==undefined?new Uint32Array(read(p.indices)):Uint32Array.from({length:positions.length/3},(_,i)=>i);
 if(indices.length>90&&ratio<1)[indices]=MeshoptSimplifier.simplify(indices,positions,3,Math.max(30,Math.floor(indices.length*ratio/3)*3),.06,['LockBorder']);
 const remap=new Map(),order=[];indices=Uint32Array.from(indices,v=>{if(!remap.has(v)){remap.set(v,order.length);order.push(v);}return remap.get(v);});
 for(const [key,id] of Object.entries(p.attributes)){const src=read(id),size=components[doc.accessors[id].type],out=new src.constructor(order.length*size);order.forEach((old,i)=>out.set(src.subarray(old*size,(old+1)*size),i*size));p.attributes[key]=add(out,doc.accessors[id]);}
 p.indices=add(indices,{componentType:5125,type:'SCALAR'});after+=indices.length/3;
}
// Prune obsolete accessors and buffer views so removed triangles also reduce bytes.
const refs=[];for(const m of doc.meshes)for(const p of m.primitives){refs.push([p,'indices']);for(const k of Object.keys(p.attributes))refs.push([p.attributes,k]);for(const t of p.targets||[])for(const k of Object.keys(t))refs.push([t,k]);}
for(const a of doc.animations||[])for(const s of a.samplers){refs.push([s,'input'],[s,'output']);}for(const s of doc.skins||[])if(s.inverseBindMatrices!==undefined)refs.push([s,'inverseBindMatrices']);
const accessors=[],map=new Map();for(const [o,k] of refs){if(o[k]===undefined)continue;const id=o[k];if(!map.has(id)){map.set(id,accessors.length);accessors.push(doc.accessors[id]);}o[k]=map.get(id);}doc.accessors=accessors;
const vrefs=[...doc.accessors.map(a=>[a,'bufferView']),...(doc.images||[]).map(i=>[i,'bufferView'])],vmap=new Map(),output=[],newViews=[];let offset=0;
for(const [o,k] of vrefs){if(o[k]===undefined)continue;const id=o[k];if(!vmap.has(id)){vmap.set(id,newViews.length);const padding=Buffer.alloc((4-offset%4)%4);output.push(padding);offset+=padding.length;const bytes=views[id];newViews.push({...doc.bufferViews[id],buffer:0,byteOffset:offset,byteLength:bytes.length});output.push(bytes);offset+=bytes.length;}o[k]=vmap.get(id);}
doc.bufferViews=newViews;doc.buffers=[{byteLength:offset}];output.push(Buffer.alloc((4-offset%4)%4));const binary=Buffer.concat(output);doc.asset.extras={...doc.asset.extras,tiranaGeometry:{originalTriangles:total,triangles:after,optimizer:'meshoptimizer simplification with locked boundaries'}};
let js=Buffer.from(JSON.stringify(doc));js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,32)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+js.length+binary.length,8);header.writeUInt32LE(js.length,12);header.writeUInt32LE(0x4e4f534a,16);const chunk=Buffer.alloc(8);chunk.writeUInt32LE(binary.length);chunk.writeUInt32LE(0x004e4942,4);const result=Buffer.concat([header,js,chunk,binary]);await writeFile(path,result);console.log(path,{before:total,after,bytes:result.length});
