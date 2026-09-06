// Convert the creator's CC0 OBJ/MTL downloads to glTF 2.0, preserving geometry/colors.
import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';
import {MTLLoader} from 'three/examples/jsm/loaders/MTLLoader.js';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(value=>{this.result=`data:${blob.type};base64,${Buffer.from(value).toString('base64')}`;this.onloadend?.();});}};
const [source,output]=process.argv.slice(2),loader=new OBJLoader();
try{const mtl=new MTLLoader().parse(await fs.readFile(source.replace(/\.obj$/,'.mtl'),'utf8'),'');mtl.preload();loader.setMaterials(mtl);}catch{}
const model=loader.parse(await fs.readFile(source,'utf8'));
model.traverse(o=>{if(o instanceof THREE.Mesh){const replace=m=>new THREE.MeshStandardMaterial({color:m.color||0x798480,roughness:.52,metalness:.25});o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);}});
const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
const glb=await new GLTFExporter().parseAsync(model,{binary:true});await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,Buffer.from(glb));console.log(path.basename(output),size.toArray(),glb.byteLength);
