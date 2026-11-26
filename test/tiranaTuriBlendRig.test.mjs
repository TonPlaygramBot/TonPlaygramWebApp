import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {test} from 'node:test';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
// Preserve exact mesh/bones, clips and transforms; remove image-only graph for Node.
const file=await readFile(process.env.TIRANA_TURI_MODEL || new URL('../webapp/public/assets/tirana-streets/players/turi.glb',import.meta.url));
const size=file.readUInt32LE(12),doc=JSON.parse(file.toString('utf8',20,20+size));
delete doc.images;delete doc.textures;delete doc.samplers;
doc.materials=doc.materials.map(({name})=>({name}));
const json=Buffer.from(JSON.stringify(doc)),padding=(4-json.length%4)%4;
const bin=file.subarray(20+size);
const head=Buffer.alloc(20);
head.write('glTF');head.writeUInt32LE(2,4);head.writeUInt32LE(20+json.length+padding+bin.length,8);
head.writeUInt32LE(json.length+padding,12);head.write('JSON',16);
const glb=Buffer.concat([head,json,Buffer.alloc(padding,32),bin]);
import {ClipTransitions} from '../webapp/src/games/tiranastreets-november/street-career/clipTransitions.mjs';
import {humanoidBones,normalizePlayableHuman} from '../webapp/src/games/tiranastreets-november/street-career/humanoidRig.mjs';
const load=()=>new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
async function measure(stable){
 const loaded=await load();
 const group=normalizePlayableHuman(loaded.scene);
 const mixer=new T.AnimationMixer(group),bones=humanoidBones(group);
 const clips=Object.fromEntries(loaded.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
 const set=Object.values(clips),blend=new ClipTransitions();
 blend.reset(set);
 const select=name=>{
  if(stable)return blend.select(clips[name]);
  for(const action of set)if(action!==clips[name])action.fadeOut(.18);
  clips[name].reset().fadeIn(.18).play();
 };
 const advance=dt=>{if(stable)blend.update(dt);mixer.update(dt);group.updateWorldMatrix(true,true);};
 const joints=['lefthand','righthand','leftleg','rightleg'];
 const pose=()=>joints.map(key=>({position:bones.get(key).getWorldPosition(new T.Vector3()),q:bones.get(key).quaternion.clone().normalize()}));
 select('Idle');advance(.20);select('Walk');advance(.04);
 const before=pose();
 select('Run');advance(0);
 const after=pose();
 return Object.fromEntries(joints.map((key,i)=>[key,{
  positionM:+before[i].position.distanceTo(after[i].position).toFixed(7),
  localAngleRad:+before[i].q.angleTo(after[i].q).toFixed(7)
 }]));
}
test('Turi GLB wrist and knee pose stays continuous when Walk is interrupted by Run',async()=>{
 const previous=await measure(false),candidate=await measure(true);
 assert.ok(Object.values(previous).some(p=>p.positionM>.01||p.localAngleRad>.05));
 assert.ok(Object.values(candidate).every(p=>p.positionM<.000001&&p.localAngleRad<.000001));
});
