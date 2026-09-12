import {writeFile} from 'node:fs/promises';
import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
// Node adapter for the exporter, never used by game code.
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result='data:'+blob.type+';base64,'+Buffer.from(result).toString('base64');this.onloadend?.();});}};
const parts=[];
for(const [x,y,z,w,h,d] of [[0,1.06,0,2.6,.07,.07],[0,.45,0,2.6,.05,.05],[-1.28,.55,0,.075,1.1,.075],[1.28,.55,0,.075,1.1,.075],...Array.from({length:11},(_,i)=>[-1.1+i*.22,.7,0,.025,.68,.025])])parts.push(new T.BoxGeometry(w,h,d).translate(x,y,z));
const geometry=mergeGeometries(parts,false),material=new T.MeshStandardMaterial({color:0x465352,metalness:.72,roughness:.42});
const mesh=new T.Mesh(geometry,material);mesh.name='roadside-rail';mesh.userData={units:'metres',author:'TonPlaygram',license:'CC0-1.0'};
const exporter=new GLTFExporter(),dir=new URL('../public/assets/tirana-streets/environment/',import.meta.url);
const glb=await exporter.parseAsync(mesh,{binary:true});await writeFile(new URL('roadside-rail.glb',dir),Buffer.from(glb));
const gltf=await exporter.parseAsync(mesh,{binary:false});await writeFile(new URL('roadside-rail.gltf',dir),JSON.stringify(gltf));
parts.forEach(p=>p.dispose());geometry.dispose();material.dispose();console.log('Authored rail GLB + glTF:',glb.byteLength,'bytes');
