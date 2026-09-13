import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
const source=await readFile(new URL('../webapp/src/pages/Games/LudoBattleRoyal.jsx',import.meta.url),'utf8');
const between=(a,b)=>{assert(source.includes(a)&&source.includes(b));return source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));};
// Use the shipped skeleton, seated pose and actor installation, not a mock rig.
const fixture=`import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { setWorldPose } from './src/games/ludo/characterContact';
export * from './src/games/ludo/characterContact';
export * from './src/games/ludo/diceMotion';
export * from './src/games/ludo/weaponModels';
export * from './src/games/ludo/weaponInteraction';
export * from './src/games/ludo/weaponEffects';
export * from './src/games/ludo/weaponParking';
export * from './src/games/ludo/weaponVolley';
export { THREE, GLTFLoader, applySeatedHumanPose };
const clamp=THREE.MathUtils.clamp,SEATED_HUMAN_MOTION_TUNING={idleBreathAmp:0};
${between('const BASE_ARENA_SCALE','const DEFAULT_PLAYER_COUNT')}
${between('const SEATED_HUMAN_DOWNWARD_CONTACT_MODE_SET','const SEATED_HELPER_FORWARD_DICE_PICKUP')}
${between('function normalizeBoneName(','const SEATED_HUMAN_TEXTURE_PROFILES')}
${between('const FRONT_SIDE_Z','function alignSeatedHumanFeetToGroundPlane(')}
export function makeSeat(template,scene,playerIndex) {
 const angle=[Math.PI/2,0,Math.PI*1.5,Math.PI][playerIndex];
 const radius=AI_CHAIR_RADIUS+CHAIR_GLOBAL_PUSHBACK+(playerIndex===0?SELF_BOTTOM_CHAIR_EXTRA_PUSHBACK:0);
 const group=new THREE.Group();group.position.set(Math.cos(angle)*radius,CHAIR_BASE_HEIGHT,Math.sin(angle)*radius);
 group.lookAt(new THREE.Vector3(0,CHAIR_BASE_HEIGHT,0));scene.add(group);
 const chair={group,supportsArmrest:true},entry={};
 const createSeatedHumanActionHelpers=()=>null;
 ${between('        const install = template => {','        install(defaultTemplate);')}
 install(template);
 entry.applyPose=(mode,grip)=>applySeatedHumanPose(entry.rig,mode,1,grip,{lateral:0,forward:1},{idleBreathAmp:0},true);
 return entry;
}`;
const directory=await mkdtemp(join(tmpdir(),'ludo-motion-'));after(()=>rm(directory,{recursive:true,force:true}));
const bundle=await build({stdin:{contents:fixture,resolveDir:new URL('../webapp/',import.meta.url).pathname,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const path=join(directory,'fixture.mjs');await writeFile(path,bundle.outputFiles[0].contents);
const {THREE,GLTFLoader,V,world,palmMarker,makeSeat,createDiceGesture,applyDiceFlight,makeWeaponFallback,prepareWeaponModel,weaponPoints,LUDO_WEAPON_SPECS,createWeaponInteraction,projectileFlightPoint,sampleCasing,aimWeaponFromPivot,setWorldPose,parkWeapon,playWeaponVolley}=await import(path);
const bytes=await readFile(new URL('../webapp/public/assets/table-tennis/chess-human.glb',import.meta.url));
const jsonSize=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonSize));
delete gltf.images;delete gltf.textures;delete gltf.samplers;delete gltf.materials;delete gltf.animations;
for(const mesh of gltf.meshes){delete mesh.weights;for(const p of mesh.primitives){delete p.material;delete p.targets;}}
for(const node of gltf.nodes)delete node.weights;
gltf.buffers=[{byteLength:bytes.length-28-jsonSize,uri:'data:application/octet-stream;base64,'+bytes.subarray(28+jsonSize).toString('base64')}];
globalThis.ProgressEvent ||= class {constructor(type,info){Object.assign(this,{type},info);}};
const template=(await new GLTFLoader().parseAsync(JSON.stringify(gltf),'')).scene;
const close=(a,b,tolerance,message)=>assert(a.distanceTo(b)<tolerance,`${message}: ${a.distanceTo(b).toFixed(6)}`);
const timing={pickupLeadMs:420,preFireLeadMs:1020,shots:3,cadenceMs:200,durationMs:3000};
for(let seat=0;seat<4;seat++){
 test(`seat ${seat}: real die pickup, skipped-frame release and fixed seated body`,()=>{
  const scene=new THREE.Group(),entry=makeSeat(template,scene,seat),board=new THREE.Group();board.position.y=.075;board.rotation.y=.23;board.scale.setScalar(.9);scene.add(board);
  const die=new THREE.Object3D();board.add(die);const outward=entry.actor.parent.position.clone().setY(0).normalize();
  const pickup=outward.clone().multiplyScalar(.60).setY(.13);setWorldPose(die,pickup);
  const rootBefore=entry.actor.position.clone(),lengths=entry.rig.bones.map(b=>b.position.clone()),palm=palmMarker(entry.rig,'right');
  let release=null,releases=0;
  const gesture=createDiceGesture(entry,die,entry.applyPose,{startMs:0,isCurrent:()=>true,onRelease:p=>{release=p;releases++;}});
  gesture.update(160);close(world(die),pickup,1e-8,'die stays at actual tabletop position');
  gesture.update(320);close(world(palm),pickup,.008,'palm reaches die');
  for(const now of [440,600,800,1099]){gesture.update(now);close(world(die),world(palm),1e-8,'held die follows palm');}
  gesture.update(1250);assert.equal(releases,1);close(world(die),release.position,1e-8,'release starts at actual palm');
  const endpoint=outward.clone().multiplyScalar(.57).setY(.13);
  applyDiceFlight(die,release,endpoint,0,.12);close(world(die),release.position,1e-8,'no flight teleport');
  applyDiceFlight(die,release,endpoint,1,.12);close(world(die),endpoint,1e-8,'world-space landing');
  gesture.update(1800);assert(gesture.finished);assert.equal(releases,1);close(entry.actor.position,rootBefore,1e-8,'fixed seated root');
  entry.rig.bones.forEach((b,i)=>close(b.position,lengths[i],1e-8,'bone lengths stay fixed'));
 });
 test(`seat ${seat}: all weapons fit the table, contact the hands and aim at the target`,()=>{
  const scene=new THREE.Group(),entry=makeSeat(template,scene,seat),palm=palmMarker(entry.rig,'right'),left=palmMarker(entry.rig,'left');
  const target=V(.12,.13,-.07),rootBefore=entry.actor.position.clone();
  for(const [id,spec] of Object.entries(LUDO_WEAPON_SPECS)){
   entry.applyPose('idle',0);const holder=new THREE.Group();holder.rotation.y=.31;scene.add(holder);
   const weapon=makeWeaponFallback(id);holder.add(weapon);
   parkWeapon(weapon,id,world(entry.actor.parent),V(),.10,()=>.702);
   const grip=world(weaponPoints(weapon).grip),box=new THREE.Box3().setFromObject(weapon);
   weapon.traverse(mesh=>{if(!mesh.isMesh)return;const pos=mesh.geometry.attributes.position;for(let i=0;i<pos.count;i++){const p=V().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);assert(Math.hypot(p.x,p.z)<.705,id+' tabletop footprint');}});
   const right=entry.actor.getWorldDirection(V()).cross(V(0,1,0));assert(grip.dot(right)>0,id+' parked screen right');
   const localBefore={p:weapon.position.clone(),q:weapon.quaternion.clone(),s:weapon.scale.clone()};
   const interaction=createWeaponInteraction(entry,weapon,scene,id,target,timing,entry.applyPose);interaction.startMs=0;
   interaction.update(timing.pickupLeadMs,target);
   if(spec.kind!=='tank')close(world(palm),world(weaponPoints(weapon).grip),.009,id+' table pickup');
   interaction.update(1300,target);const points=weaponPoints(weapon);
   const thrown=['grenade','dynamite','bottle','canister'].includes(spec.kind);
   if(spec.kind!=='tank'&&!thrown){
    close(world(palm),world(points.grip),.009,id+' right grip');
    if(spec.twoHands)close(world(left),world(points.support),.009,id+' support grip');
   }
   if(!thrown){
   const direction=weapon.getWorldDirection(V()),delta=target.clone().sub(world(points.muzzle));
   assert(delta.dot(direction)>0,id+' faces target');assert(delta.cross(direction).length()<.0001,id+' muzzle ray');
   for(const x of [-.35,.35])for(const z of [-.35,.35]){
    const near=V(x,.13,z);interaction.update(1300,near);const ray=near.clone().sub(world(points.muzzle)),facing=weapon.getWorldDirection(V());
    if(spec.kind!=='tank'){close(world(palm),world(points.grip),.009,id+' near grip');if(spec.twoHands)close(world(left),world(points.support),.009,id+' near support');}
    assert(ray.dot(facing)>0,id+' near-corner aim');assert(ray.cross(facing).length()<.0001,id+' near-corner muzzle ray');
   }
   }
   close(entry.actor.position,rootBefore,1e-8,id+' fixed seat');interaction.release();assert.equal(weapon.parent,holder);
   close(weapon.position,localBefore.p,1e-8,id+' restored position');close(weapon.scale,localBefore.s,1e-8,id+' identical parked/held scale');assert(weapon.quaternion.angleTo(localBefore.q)<1e-6);holder.removeFromParent();
  }
 });
}
test('superseded pickup settles the waiting roll without moving the die',()=>{
 const scene=new THREE.Group(),entry=makeSeat(template,scene,0),die=new THREE.Object3D();scene.add(die);die.position.set(0,.13,.62);const initial=die.position.clone();let result='waiting';
 const motion=createDiceGesture(entry,die,entry.applyPose,{startMs:0,isCurrent:()=>false,onRelease:p=>result=p});motion.update(1500);
 assert.equal(result,null);assert(motion.finished);close(die.position,initial,1e-9,'cancelled position');
});
test('authored weapon axes and physical lengths normalize once',()=>{
 for(const axis of ['x','y','z']){
  const model=new THREE.Group();model.add(new THREE.Mesh(new THREE.BoxGeometry(.1,.25,2),new THREE.MeshBasicMaterial()));
  const muzzle=new THREE.Object3D();muzzle.name='muzzle';muzzle.position.set(.017,.08,1);model.add(muzzle);
  if(axis==='x')model.rotation.y=Math.PI/2;if(axis==='y')model.rotation.x=Math.PI/2;
  const weapon=prepareWeaponModel(model,'assaultRifleAttack'),scene=new THREE.Group();scene.add(weapon);
  assert(Math.abs(new THREE.Box3().setFromObject(weapon).getSize(V()).z-.8*.65)<.00001);
  const target=V(.9,.14,.7),pivot=weaponPoints(weapon).stock.position,anchor=V(-.1,.5,-.4),aim=aimWeaponFromPivot(weapon,pivot,anchor,target);setWorldPose(weapon,aim.position,aim.quaternion);
  assert(target.clone().sub(world(weaponPoints(weapon).muzzle)).cross(weapon.getWorldDirection(V())).length()<1e-6);
 }
 assert(LUDO_WEAPON_SPECS.mosinMarksmanAttack.length>LUDO_WEAPON_SPECS.ak47VolleyAttack.length);
 assert(LUDO_WEAPON_SPECS.ak47VolleyAttack.length>LUDO_WEAPON_SPECS.glockSidearmAttack.length);
});
test('projectile and casing paths preserve the release origin',()=>{
 const start=V(.2,.5,.6),end=V(-.2,.13,-.3),velocity=V(.3,.3,.1);
 close(projectileFlightPoint(start,end,0,true),start,1e-9,'thrown start');close(projectileFlightPoint(start,end,1,true),end,1e-9,'impact');
 assert(projectileFlightPoint(start,end,.5,true).y>start.clone().lerp(end,.5).y);
 close(sampleCasing(start,velocity,0,.13),start,1e-9,'ejection');assert.equal(sampleCasing(start,velocity,1,.13).y,.13);
});
test('real volley survives sparse frames, emits only correct shells and cancels cleanly',async()=>{
 for(const id of ['ak47VolleyAttack','smithSidearmAttack','polyBazooka01Attack','polyMolotov01Attack']){
  const scene=new THREE.Group(),entry=makeSeat(template,scene,0),holder=new THREE.Group();scene.add(holder);const weapon=makeWeaponFallback(id);holder.add(weapon);
  let frame,shots=0,ejections=0,impacts=0,current=true;
  const options={scene,entry,weapon,id,surfaceY:.10,applyPose:entry.applyPose,target:()=>V(.1,.13,-.2),isCurrent:()=>current,onShot:eject=>{shots++;if(eject)ejections++;},onImpact:()=>impacts++,requestFrame:f=>frame=f,now:()=>0};
  const result=playWeaponVolley(options);for(const time of [0,500,1100,1700,2400,4000,7000,10000])frame(time);
  assert.equal(await result,true);assert(shots>0);assert.equal(impacts,1);assert.equal(ejections,LUDO_WEAPON_SPECS[id].ejectsCase?shots:0);assert.equal(weapon.parent,holder);
  current=true;const cancelled=playWeaponVolley(options);frame(100);current=false;frame(200);assert.equal(await cancelled,false);assert.equal(weapon.parent,holder);assert.equal(scene.children.length,2);
 }
});
