// Headless loading/geometry checks: this does not assert browser pixel output.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildSync} from '../webapp/node_modules/esbuild/lib/main.js';
import * as T from '../webapp/node_modules/three/build/three.module.js';
const temp = new URL('../webapp/node_modules/.cache/force-test/', import.meta.url);
mkdirSync(temp, {recursive:true});
buildSync({entryPoints:[fileURLToPath(new URL('../webapp/src/games/tiranastreets/AlbanianForcesVisuals.ts',import.meta.url))], outfile:fileURLToPath(new URL('runtime.mjs',temp)), bundle:true, platform:'node', format:'esm', external:['three','three/*'], logLevel:'silent'});
const {AlbanianForcesVisuals} = await import(new URL('runtime.mjs',temp));
const originalFetch = globalThis.fetch;
const originalBitmap = globalThis.createImageBitmap, originalSelf = globalThis.self;
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({width:1024,height:1024,close(){}});
let downloads = [];
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith('blob:')) return originalFetch(url, options);
  downloads.push(String(url));
  const path = new URL(`../webapp/public${url}`, import.meta.url);
  return new Response(readFileSync(path), {headers:{'content-type':'model/gltf-binary'}});
};
test.after(() => {globalThis.fetch=originalFetch;globalThis.createImageBitmap=originalBitmap;globalThis.self=originalSelf;rmSync(temp,{recursive:true,force:true});});
const state = () => ({cars:[],traffic:[],units:[],npcs:[]});
const car = (id,x=0) => ({id,x,z:0,model:'police',forceVehicle:'patrol_hatch',heading:0,speed:5,steering:.5});
const npc = (id,x=0) => ({id,x,z:0,kind:'police',forceCharacter:'patrol_officer',motion:'walk',heading:0,speed:1.4,health:100});
async function settle(layer) {
  const deadline=Date.now()+10000;
  while(layer.pending.size){if(Date.now()>deadline)throw Error('Asset loading timed out');await new Promise(r=>setTimeout(r,10));}
  assert.equal(layer.errors.size,0,JSON.stringify([...layer.errors]));
}
test('actual vehicle GLB loads lazily, faces travel, spins only wheel pivots, and reuses its cache', async () => {
  const layer = new AlbanianForcesVisuals();
  try {
    downloads=[];const s=state();s.units=[car('patrol')];
    layer.update(s,{x:0,z:0},0,1/60);
    assert.equal(layer.has('patrol'),false);assert.equal(layer.ownsVehicle(s.units[0]),true,'pending final model suppresses the generic replacement');
    await settle(layer);layer.update(s,{x:0,z:0},.1,1/60);
    const root=layer.getRoot('patrol');assert.ok(root);
    const bounds=new T.Box3().setFromObject(root,true),size=bounds.getSize(new T.Vector3());
    assert.ok(size.z>size.x && size.z>3.5 && size.z<4.6,'metre-sized vehicle is aligned to travel');
    assert.ok(Math.abs(bounds.min.y-.03)<.01,`tires remain on the road: ${bounds.min.y}`);
    assert.ok(root.getObjectByName('Wheel_FL').rotation.z<0);
    assert.equal(root.getObjectByName('Steer_FL').rotation.y,-.16);
    const forward=new T.Vector3(1,0,0).transformDirection(root.getObjectByName('patrol_hatch').matrixWorld);
    assert.ok(forward.z<-.99,'pack +X points in the game heading 0 travel direction');
    layer.update(s,{x:1000,z:1000},.2,1/60);assert.equal(layer.has('patrol'),false);
    layer.update(s,{x:0,z:0},.3,1/60);assert.ok(layer.has('patrol'));
    assert.equal(downloads.length,1,'moving out of detail range does not reload the GLB');
  } finally {layer.dispose();}
});
test('actual officer clones keep independent skeletons and switch Idle/Walk without scaling the rig', async () => {
  const layer=new AlbanianForcesVisuals();
  try {
    const s=state();s.npcs=[npc('a'),{...npc('b',1),speed:0}];
    layer.update(s,{x:0,z:0},0,1/60);await settle(layer);layer.update(s,{x:0,z:0},1,1/60);
    const roots=[layer.getRoot('npc-a'),layer.getRoot('npc-b')];assert.ok(roots.every(Boolean));
    const skins=roots.map(root=>{let skin;root.traverse(o=>{if(o instanceof T.SkinnedMesh)skin=o;});return skin;});
    assert.notEqual(skins[0].skeleton,skins[1].skeleton);
    assert.notEqual(skins[0].skeleton.bones[0],skins[1].skeleton.bones[0]);
    const a=layer.actors.get('npc-a');assert.equal(a.moving,false,'stationary actor ignores stale speed hint');
    for(let i=0;i<30;i++){s.npcs[0].z-=1.4/60;layer.update(s,{x:0,z:0},1+i/60,1/60);}
    assert.ok(a.walk.isRunning());assert.equal(a.moving,true);
    s.npcs[0].speed=0;for(let i=0;i<90;i++)layer.update(s,{x:0,z:0},2+i/60,1/60);assert.equal(a.moving,false);assert.ok(a.idle.isRunning());
    const height=new T.Box3().setFromObject(roots[1]).getSize(new T.Vector3()).y;
    assert.ok(height>1.7 && height<2.1,'human proportions remain in metres');
    s.npcs[0].health=0;layer.update(s,{x:0,z:0},3,.1);assert.equal(roots[0].rotation.x,-Math.PI/2);
  } finally {layer.dispose();}
});
test('failed downloads retain fallback availability and dispose prevents late scene attachment', async () => {
  const layer=new AlbanianForcesVisuals(), goodFetch=globalThis.fetch, warn=console.warn;
  try {
    console.warn=()=>{};globalThis.fetch=async()=>new Response('',{status:404});
    const s=state();s.units=[car('missing')];layer.update(s,{x:0,z:0},0,1/60);
    while(layer.pending.size)await new Promise(r=>setTimeout(r,10));
    assert.equal(layer.has('missing'),false);assert.equal(layer.ownsVehicle(s.units[0]),false,'failed asset exposes a stable fallback');assert.equal(layer.errors.size,1);
    globalThis.fetch=goodFetch;layer.retryFailed();layer.dispose();
    while(layer.pending.size)await new Promise(r=>setTimeout(r,10));
    assert.equal(layer.group.children.length,0);assert.equal(layer.sources.size,0);
  } finally {globalThis.fetch=goodFetch;console.warn=warn;layer.dispose();}
});
test('aiming changes private arm bones and cover lowers the visible officer',async()=>{
 const layer=new AlbanianForcesVisuals();
 try{
  const s=state();s.npcs=[{...npc('pose'),speed:0,anim:'idle',weapon:'ak47VolleyAttack'}];
  layer.update(s,{x:0,z:0},0,1/60);await settle(layer);layer.update(s,{x:0,z:0},1,1/60);
  const root=layer.getRoot('npc-pose'),bone=root.getObjectByName(T.PropertyBinding.sanitizeNodeName('upperarm01.R'));assert.ok(bone);
  const idle=bone.quaternion.clone();s.npcs[0].anim='aim';for(let i=0;i<15;i++)layer.update(s,{x:0,z:0},2+i/60,1/60);assert.ok(bone.quaternion.angleTo(idle)>.1);
  const standing=root.position.y;s.npcs[0].anim='cover';for(let i=0;i<30;i++)layer.update(s,{x:0,z:0},3+i/60,1/60);assert.ok(root.position.y<standing-.25);
  s.npcs[0].anim='ride';s.npcs[0].motion='drive';layer.update(s,{x:0,z:0},4,1/60);assert.ok(layer.has('npc-pose'),'motorcycle passengers are rendered');
 }finally{layer.dispose();}
});

test('original force wrists reach the same firearm grips used by the rendered weapon',async()=>{
 const {npcWeaponPose}=await import('../webapp/src/games/tiranastreets/shared/npcWeaponPose.mjs');
 const layer=new AlbanianForcesVisuals();
 try{
  const s=state();s.npcs=[{...npc('grip'),anim:'aim',weapon:'ak47VolleyAttack',aimPitch:0}];
  layer.update(s,{x:0,z:0},0,1/60);await settle(layer);
  for(const weapon of ['ak47VolleyAttack','glockSidearmAttack']){
   s.npcs[0].weapon=weapon;for(let i=0;i<90;i++)layer.update(s,{x:0,z:0},i/60,1/60);
   const root=layer.getRoot('npc-grip'),pose=npcWeaponPose(s.npcs[0]);root.updateMatrixWorld(true);
   for(const [side,grip] of [['R',pose.right],['L',pose.left]]){
    const actual=root.getObjectByName(T.PropertyBinding.sanitizeNodeName(`wrist.${side}`)).getWorldPosition(new T.Vector3());
    const desired=root.localToWorld(new T.Vector3(grip.x,grip.y,grip.z));
    assert.ok(actual.distanceTo(desired)<.035,`${weapon} ${side}: ${actual.distanceTo(desired)} metres`);
    const original=layer.sources.get('patrol_officer').frame,openWrist=original.getObjectByName(T.PropertyBinding.sanitizeNodeName(`wrist.${side}`)).getWorldPosition(new T.Vector3());
    let openSpan=0,gripSpan=0;
    for(const finger of [2,3,4,5]){
      const name=T.PropertyBinding.sanitizeNodeName(`finger${finger}-3.${side}`);
      openSpan+=original.getObjectByName(name).getWorldPosition(new T.Vector3()).distanceTo(openWrist);
      gripSpan+=root.getObjectByName(name).getWorldPosition(new T.Vector3()).distanceTo(actual);
    }
    assert.ok(gripSpan<openSpan*.95,`${side}: fingers curl around the grip rather than remaining splayed`);
   }
  }
 }finally{layer.dispose();}
});

test('an unarmed officer retains the original relaxed walking arms',async()=>{
 const layer=new AlbanianForcesVisuals();
 try{
  const s=state();s.npcs=[{...npc('unarmed'),weapon:'',anim:'idle',speed:0}];
  layer.update(s,{x:0,z:0},0,1/60);await settle(layer);
  for(let i=0;i<30;i++)layer.update(s,{x:0,z:0},i/60,1/60);
  const root=layer.getRoot('npc-unarmed');root.updateMatrixWorld(true);
  for(const side of ['L','R']){
    const hand=root.worldToLocal(root.getObjectByName(T.PropertyBinding.sanitizeNodeName(`wrist.${side}`)).getWorldPosition(new T.Vector3()));
    assert.ok(hand.y<1.2,'no phantom firearm pose when the NPC has no weapon');
  }
 }finally{layer.dispose();}
});

test('original force uniforms layer a magazine reach and flinch over native locomotion',async()=>{
 const layer=new AlbanianForcesVisuals();
 try{
  const s=state();s.npcs=[{...npc('actions'),weapon:'ak47VolleyAttack',anim:'aim',speed:0}];
  layer.update(s,{x:0,z:0},0,1/60);await settle(layer);
  for(let i=0;i<60;i++)layer.update(s,{x:0,z:0},i/60,1/60);
  const root=layer.getRoot('npc-actions'),wrist=root.getObjectByName(T.PropertyBinding.sanitizeNodeName('wrist.L')),spine=root.getObjectByName('spine03');
  const before=root.worldToLocal(wrist.getWorldPosition(new T.Vector3())),restSpine=spine.quaternion.clone();
  s.npcs[0].anim='reload';for(let i=0;i<30;i++)layer.update(s,{x:0,z:0},1+i/60,1/60);
  const reach=root.worldToLocal(wrist.getWorldPosition(new T.Vector3()));assert.ok(reach.y<before.y-.08,'support hand reaches the magazine');
  s.npcs[0].anim='hit';s.npcs[0].hitUntil=2.28;layer.update(s,{x:0,z:0},2,1/60);
  assert.ok(spine.quaternion.angleTo(restSpine)>.06,'confirmed hit bends the upper torso');
  s.npcs[0].anim='aim';for(let i=0;i<60;i++)layer.update(s,{x:0,z:0},3+i/60,1/60);
  const recovered=root.worldToLocal(wrist.getWorldPosition(new T.Vector3()));assert.ok(recovered.distanceTo(before)<.04,'after the action the support hand returns to the same firearm grip');
  root.traverse(o=>{if(o.isBone)assert.ok(o.quaternion.toArray().every(Number.isFinite));});
 }finally{layer.dispose();}
});

test('RENEA, FNSH and Shqiponja load their full original uniform meshes and maps',async()=>{
 const manifest=JSON.parse(readFileSync(new URL('../webapp/public/assets/tirana-streets/albanian-forces/manifest.json',import.meta.url)));
 const layer=new AlbanianForcesVisuals();
 try{
  const s=state();s.npcs=['renea_officer','fnsh_officer','shqiponja_officer'].map((id,i)=>({...npc(id,i*2),forceCharacter:id,anim:'idle'}));
  layer.update(s,{x:0,z:0},0,1/60);await settle(layer);layer.update(s,{x:0,z:0},1,1/60);
  for(const n of s.npcs){
   const root=layer.getRoot('npc-'+n.id);assert.ok(root);let triangles=0,maps=0,joints=0;
   root.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const material of Array.isArray(o.material)?o.material:[o.material]){if(material.map)maps++;if(material.normalMap)maps++;}}if(o.isBone)joints++;});
   assert.equal(triangles,manifest.find(a=>a.id===n.id).sourceTriangles,`${n.id}: original geometry, never the reduced substitute`);
   assert.ok(maps>=4&&joints>=160,`${n.id}: textured uniform and original rig`);
   const hips=root.getObjectByName('root'),head=root.getObjectByName('head');assert.ok(hips&&head);
   assert.ok(head.getWorldPosition(new T.Vector3()).y>hips.getWorldPosition(new T.Vector3()).y+.4);
  }
 }finally{layer.dispose();}
});

test('a transient uniform download failure automatically returns to the original without a reload',async()=>{
 const layer=new AlbanianForcesVisuals(),goodFetch=globalThis.fetch,warn=console.warn;let attempts=0,retryCache;
 try{
  console.warn=()=>{};globalThis.fetch=async(url,options)=>{
   if(String(url).startsWith('blob:'))return goodFetch(url,options);
   attempts++;if(attempts===1)return new Response('',{status:503});retryCache=options.cache;return goodFetch(url,options);
  };
  const s=state();s.npcs=[{...npc('retry'),forceCharacter:'renea_officer'}];
  layer.update(s,{x:0,z:0},0,1/60);await layer.whenIdle();
  assert.equal(layer.errors.size,1);assert.equal(layer.ownsPerson(s.npcs[0]),false);
  for(let i=0;i<10;i++)layer.update(s,{x:0,z:0},i*.25,.25);
  await settle(layer);layer.update(s,{x:0,z:0},3,1/60);
  assert.equal(attempts,2);assert.equal(retryCache,'reload','a cached broken response is bypassed');
  assert.equal(layer.errors.size,0);assert.equal(layer.ownsPerson(s.npcs[0]),true);assert.ok(layer.getRoot('npc-retry').getObjectByName('renea_officer'));
 }finally{globalThis.fetch=goodFetch;console.warn=warn;layer.dispose();}
});
