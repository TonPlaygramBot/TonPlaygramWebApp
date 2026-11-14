import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const webapp=fileURLToPath(new URL('../webapp/',import.meta.url)),require=createRequire(join(webapp,'package.json'));
const {build}=require('esbuild'),T=await import(pathToFileURL(join(webapp,'node_modules/three/build/three.module.js')));
const dir=mkdtempSync(join(webapp,'.cinematic-test-'));after(()=>rmSync(dir,{recursive:true,force:true}));
async function bundle(path,name){const file=join(dir,name+'.mjs');await build({entryPoints:[join(webapp,'src/games',path)],outfile:file,bundle:true,platform:'node',format:'esm',external:['three','three/*'],logLevel:'silent'});return import(pathToFileURL(file));}

class Param{value=0;setValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}linearRampToValueAtTime(v){this.value=v;}exponentialRampToValueAtTime(v){this.value=v;}cancelScheduledValues(){}}
class Node{gain=new Param();frequency=new Param();pan=new Param();threshold=new Param();ratio=new Param();connections=[];connect(n){this.connections.push(n);return n;}disconnect(){this.connections=[];}start(at){this.started=at;}stop(){this.stopped=true;}}
class Context{state='suspended';currentTime=1;sampleRate=1000;destination=new Node();sources=[];createGain(){return new Node();}createDynamicsCompressor(){return new Node();}createBiquadFilter(){return new Node();}createStereoPanner(){return new Node();}createOscillator(){const n=new Node();this.sources.push(n);return n;}createBufferSource(){const n=new Node();this.sources.push(n);return n;}createBuffer(_,count){return{getChannelData:()=>new Float32Array(count)};}async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}}
globalThis.AudioContext=Context;

test('packed Blender Grand decodes to metre dimensions without a decoder download',async()=>{
 const {GLTFLoader}=await import(pathToFileURL(join(webapp,'node_modules/three/examples/jsm/loaders/GLTFLoader.js')));
 const bytes=readFileSync(join(webapp,'public/assets/tirana-streets/neighbourhood/grand.glb')),len=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+len));
 assert.ok(doc.extensionsRequired.includes('KHR_mesh_quantization'));const binary=bytes.subarray(28+len);
 doc.buffers[0].uri='data:application/octet-stream;base64,'+binary.toString('base64');delete doc.images;delete doc.textures;doc.materials=doc.materials.map(m=>({name:m.name,pbrMetallicRoughness:{baseColorFactor:m.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1]}}));
 globalThis.ProgressEvent ||= class ProgressEvent{constructor(type,args){Object.assign(this,{type,...args});}};
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');const size=new T.Box3().setFromObject(gltf.scene).getSize(new T.Vector3());assert.ok(size.x>90&&size.x<110);assert.ok(size.y>28&&size.y<33);assert.ok(size.z>30&&size.z<45);
 gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
});
