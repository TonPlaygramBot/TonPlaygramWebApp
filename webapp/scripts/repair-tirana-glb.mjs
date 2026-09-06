// Repair legacy exporter layouts without dropping the human/shotgun animation tracks.
import fs from 'node:fs/promises';
import * as THREE from 'three';
const [path]=process.argv.slice(2),data=await fs.readFile(path),length=data.readUInt32LE(12),doc=JSON.parse(data.subarray(20,20+length)),binary=data.subarray(28+length);
const old=doc.bufferViews.map(v=>binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)),views=[],bytes=[];
const size={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function view(data){const id=views.length;views.push({buffer:0,byteLength:data.length});bytes.push(data);return id;}
const weights=new Set(doc.meshes.flatMap(m=>m.primitives.map(p=>p.attributes.WEIGHTS_0)).filter(i=>i!==undefined));
const packed=[];
for(const [i,a] of doc.accessors.entries()){
 if(a.bufferView===undefined||a.sparse)throw Error('Unsupported sparse accessor');
 const v=doc.bufferViews[a.bufferView],width=size[a.componentType]*components[a.type],buffer=Buffer.alloc(a.count*width);
 for(let n=0;n<a.count;n++)old[a.bufferView].copy(buffer,n*width,(a.byteOffset||0)+n*(v.byteStride||width),(a.byteOffset||0)+n*(v.byteStride||width)+width);
 if(weights.has(i)&&a.componentType===5126){for(let n=0;n<a.count;n++){let total=0;for(let c=0;c<4;c++)total+=buffer.readFloatLE(n*16+c*4);if(total>0)for(let c=0;c<4;c++)buffer.writeFloatLE(buffer.readFloatLE(n*16+c*4)/total,n*16+c*4);else buffer.writeFloatLE(1,n*16);}}
 packed[i]=buffer; a.bufferView=view(buffer);delete a.byteOffset;
}
for(const mesh of doc.meshes)for(const primitive of mesh.primitives){
 const wi=primitive.attributes.WEIGHTS_0,ji=primitive.attributes.JOINTS_0;
 if(wi===undefined||ji===undefined||doc.accessors[wi].componentType!==5126)continue;
 delete doc.accessors[ji].min;delete doc.accessors[ji].max;
 const weights=packed[wi],joints=packed[ji],bytes=size[doc.accessors[ji].componentType];
 for(let i=0;i<doc.accessors[wi].count*4;i++)if(weights.readFloatLE(i*4)===0)joints.fill(0,i*bytes,(i+1)*bytes);
}
for(const image of doc.images||[])if(image.bufferView!==undefined)image.bufferView=view(Buffer.from(old[image.bufferView]));
// Three's loader already decomposes matrices; store that same representable TRS explicitly.
for(const node of doc.nodes||[])if(node.matrix){const m=new THREE.Matrix4().fromArray(node.matrix),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();m.decompose(p,q,s);node.translation=p.toArray();node.rotation=q.toArray();node.scale=s.toArray();delete node.matrix;}
function clean(o){if(!o||typeof o!=='object')return;for(const k of Object.keys(o)){if(['extensions','extensionsUsed','extensionsRequired','extras'].includes(k)&&o[k]&&Object.keys(o[k]).length===0)delete o[k];else clean(o[k]);}}
clean(doc);doc.asset.extras={...doc.asset.extras,tiranaRepair:'Packed accessor views, normalized skin weights and representable TRS transforms.'};
let offset=0;const out=[];for(let i=0;i<views.length;i++){const pad=Buffer.alloc((4-offset%4)%4);out.push(pad);offset+=pad.length;views[i].byteOffset=offset;out.push(bytes[i]);offset+=bytes[i].length;}doc.bufferViews=views;doc.buffers=[{byteLength:offset}];out.push(Buffer.alloc((4-offset%4)%4));const bin=Buffer.concat(out);
let js=Buffer.from(JSON.stringify(doc));js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,32)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+js.length+bin.length,8);header.writeUInt32LE(js.length,12);header.writeUInt32LE(0x4e4f534a,16);const chunk=Buffer.alloc(8);chunk.writeUInt32LE(bin.length);chunk.writeUInt32LE(0x004e4942,4);await fs.writeFile(path,Buffer.concat([header,js,chunk,bin]));console.log(path,28+js.length+bin.length);
