import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {prepareHumanMaterials} from '../webapp/src/games/tiranastreets/street-career/humanMaterials.mjs';
import {createBody} from '../webapp/src/games/tiranastreets/street-career/playerCore.mjs';

const webapp=fileURLToPath(new URL('../webapp/',import.meta.url));
const dir=await mkdtemp(join(webapp,'.human-quality-test-'));
after(()=>rm(dir,{recursive:true,force:true}));
await build({entryPoints:[join(webapp,'src/games/tiranastreets/street-career/FirstPersonBody.ts')],outfile:join(dir,'body.mjs'),bundle:true,platform:'node',format:'esm',external:['three','three/*'],logLevel:'silent'});
const {FirstPersonBody}=await import(pathToFileURL(join(dir,'body.mjs')));

test('human PBR preparation keeps source textures and normals immutable and owns its copies',()=>{
  const albedo=new T.Texture(),normal=new T.Texture(),roughness=new T.Texture();
  const skin=new T.MeshPhysicalMaterial({map:albedo,emissiveMap:albedo,normalMap:normal,metalness:.6,roughness:.1,clearcoat:1});
  skin.name='head_mat';
  const clothing=new T.MeshStandardMaterial({map:albedo,normalMap:normal,roughnessMap:roughness,metalness:.3});clothing.name='body_armor';
  const geometry=new T.BoxGeometry(),root=new T.Group();
  const first=new T.Mesh(geometry,[skin,clothing]),second=new T.Mesh(geometry,skin);root.add(first,second);
  const normals=Array.from(geometry.getAttribute('normal').array);
  let sourceDisposals=0,ownedMaterialDisposals=0,ownedTextureDisposals=0;
  for(const source of [skin,clothing,albedo,normal,roughness,geometry])source.addEventListener('dispose',()=>sourceDisposals++);
  const release=prepareHumanMaterials(root),prepared=first.material[0];
  prepared.addEventListener('dispose',()=>ownedMaterialDisposals++);
  prepared.map.addEventListener('dispose',()=>ownedTextureDisposals++);
  assert.notEqual(prepared,skin);assert.equal(second.material,prepared);
  assert.notEqual(prepared.map,albedo);assert.equal(prepared.map,prepared.emissiveMap);
  assert.equal(prepared.map,first.material[1].map,'shared color images stay shared per source');
  assert.equal(prepared.map.colorSpace,T.SRGBColorSpace);assert.equal(albedo.colorSpace,T.NoColorSpace);
  assert.equal(prepared.normalMap,normal);assert.equal(normal.colorSpace,T.NoColorSpace);
  assert.equal(first.material[1].roughnessMap,roughness);assert.equal(first.material[1].metalness,.3);
  assert.equal(prepared.metalness,0);assert.equal(prepared.roughness,.55);assert.equal(prepared.clearcoat,0);
  assert.equal(prepared.normalScale.x,.7);assert.equal(skin.normalScale.x,1);
  assert.deepEqual(Array.from(geometry.getAttribute('normal').array),normals);
  const liveInstances=new T.Scene(),actor=second.clone();liveInstances.add(actor);
  release(liveInstances);release(liveInstances);
  assert.equal(first.material[0],skin);assert.equal(second.material,skin);
  assert.equal(actor.material,skin,'live clones restore source before normal scene disposal');
  assert.equal(sourceDisposals,0);assert.equal(ownedMaterialDisposals,1);assert.equal(ownedTextureDisposals,1);
});

test('actual Agent 47 skin keeps glossy eyes and clothing separate from face treatment',async()=>{
  const data=await readFile(join(webapp,'public/assets/tirana-streets/players/agent-47.glb'));
  const loader=new GLTFLoader();loader.register(()=>({name:'HEADLESS_TEXTURES',loadTexture:async()=>new T.Texture()}));
  const gltf=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const before=new Map();gltf.scene.traverse(mesh=>{if(mesh.isMesh)for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])before.set(mat.name,mat);});
  const release=prepareHumanMaterials(gltf.scene),after=new Map();gltf.scene.traverse(mesh=>{if(mesh.isMesh)for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])after.set(mat.name,mat);});
  assert.equal(after.get('eyes_mat').roughness,before.get('eyes_mat').roughness);
  assert.equal(after.get('jacket_mat').roughness,before.get('jacket_mat').roughness);
  assert.equal(after.get('head_mat').metalness,0);
  assert.equal(after.get('head_mat').normalMap,before.get('head_mat').normalMap);
  release();
});

function actorFixture(){
  const group=new T.Group(),hips=new T.Bone();hips.name='Hips';group.add(hips);
  const mixer=new T.AnimationMixer(group);
  const clips=Object.fromEntries([['Idle',2],['Walk',1],['Run',.7]].map(([name,duration])=>{
    const clip=new T.AnimationClip(name,duration,[new T.QuaternionKeyframeTrack('Hips.quaternion',[0,duration],[0,0,0,1,0,0,0,1])]);
    return [name,mixer.clipAction(clip)];
  }));
  const actor={group,mixer,clips,idle:clips.Idle,walk:clips.Walk,run:clips.Run,model:'character',wheels:[]};
  const body=createBody(0),player={x:0,z:0,health:100,speed:1.45,weapon:'',nextShot:0};
  const rig=new FirstPersonBody(new T.Scene());
  return {actor,body,player,rig};
}

test('local walk/run blends preserve stride phase and equipment fallback does not restart the gait',()=>{
  const {actor,body,player,rig}=actorFixture();
  for(let frame=0;frame<20;frame++)rig.update(actor,player,body,frame/60,1/60);
  const phase=actor.walk.time/actor.walk.getClip().duration;
  player.speed=4;rig.update(actor,player,body,1,0);
  assert.ok(Math.abs(actor.run.time/actor.run.getClip().duration-phase)<1e-8);
  for(const speed of [3.05,2.95,3.2,2.8]){player.speed=speed;rig.update(actor,player,body,1.1,0);assert.equal(rig.activeMotion,actor.run);}
  // No matching Run_Shoot: the existing run action should continue untouched.
  const runningPhase=actor.run.time;player.weapon='unknown-rifle';rig.update(actor,player,body,1.2,0);
  assert.equal(actor.run.time,runningPhase);
  rig.dispose();
});

test('local animation limits resume jumps and crouch body follows the motor eye transition',()=>{
  const {actor,body,player,rig}=actorFixture();
  player.speed=5.4;rig.update(actor,player,body,0,.016);
  const before=actor.mixer.time;rig.update(actor,player,body,3,3);
  assert.ok(actor.mixer.time-before<=.100001,'background-tab delta cannot fast-forward animation');
  player.speed=0;body.crouched=true;body.eye=1.28;
  rig.update(actor,player,body,3.1,.016);
  assert.ok(Math.abs(actor.group.position.y-(body.y-.26))<1e-8,'halfway eye transition lowers body halfway');
  rig.dispose();
});
