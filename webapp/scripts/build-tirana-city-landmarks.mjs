// Only original project interpretations of the two historical exteriors are exported.
import {readFile,writeFile} from 'node:fs/promises';
import {buildNativeModel,MATERIALS} from '../src/games/tirana-landmarks/nativeModels.mjs';
const map=JSON.parse(await readFile(new URL('../public/assets/tirana-city-game/central-city.json',import.meta.url),'utf8'));
const markings=map.markings.filter(m=>['clock','mosque'].includes(m.id));
// Bake the two authored historical exteriors to one glTF 2.0 binary.
const gltf={asset:{version:'2.0',generator:'TonPlayGram public Tirana landmarks'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],accessors:[],bufferViews:[],buffers:[],materials:[]};
const materialIds=new Map(),chunks=[];let byteOffset=0;
const linear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
function materialFor(name){
  if(materialIds.has(name))return materialIds.get(name);
  const {color,roughness,metalness}=MATERIALS[name];const i=gltf.materials.length;materialIds.set(name,i);
  gltf.materials.push({name,pbrMetallicRoughness:{baseColorFactor:[(color>>16)&255,(color>>8)&255,color&255].map(v=>linear(v/255)).concat(1),roughnessFactor:roughness,metallicFactor:metalness}});
  return i;
}
function attribute(values,position=false){
  const data=Buffer.alloc(values.length*4);const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  values.forEach((v,i)=>{data.writeFloatLE(v,i*4);if(position){const value=data.readFloatLE(i*4);min[i%3]=Math.min(min[i%3],value);max[i%3]=Math.max(max[i%3],value);}});
  const bufferView=gltf.bufferViews.length;
  gltf.bufferViews.push({buffer:0,byteOffset,byteLength:data.length,target:34962});
  chunks.push(data);byteOffset+=data.length;
  const index=gltf.accessors.length;gltf.accessors.push({bufferView,componentType:5126,count:values.length/3,type:'VEC3',...(position?{min,max}:{})});return index;
}
for(const m of markings){
  const primitives=buildNativeModel(m.id,'near').meshes.map(p=>({material:materialFor(p.material),mode:4,attributes:{POSITION:attribute(p.positions,true),NORMAL:attribute(p.normals)}}));
  const mesh=gltf.meshes.length;gltf.meshes.push({name:m.id,primitives});
  gltf.scenes[0].nodes.push(gltf.nodes.length);gltf.nodes.push({name:m.id,mesh,translation:[m.x,m.groundY,m.z],rotation:[0,Math.sin(m.yaw/2),0,Math.cos(m.yaw/2)]});
}
gltf.buffers.push({byteLength:byteOffset});const json=Buffer.from(JSON.stringify(gltf));const jsonPadded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
function words(...vals){const b=Buffer.alloc(vals.length*4);vals.forEach((v,i)=>b.writeUInt32LE(v,i*4));return b;}
await writeFile(new URL('../public/assets/tirana-city-game/public-landmarks.glb',import.meta.url),Buffer.concat([words(0x46546c67,2,28+jsonPadded.length+byteOffset),words(jsonPadded.length,0x4e4f534a),jsonPadded,words(byteOffset,0x004e4942),...chunks]));
