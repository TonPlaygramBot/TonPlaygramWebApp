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
    assert.equal(layer.has('patrol'),false,'existing game actor remains available during loading');
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
    const a=layer.actors.get('npc-a');assert.ok(a.walk.isRunning());assert.equal(a.moving,true);
    s.npcs[0].speed=0;layer.update(s,{x:0,z:0},2,.2);assert.equal(a.moving,false);assert.ok(a.idle.isRunning());
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
    assert.equal(layer.has('missing'),false);assert.equal(layer.errors.size,1);
    globalThis.fetch=goodFetch;layer.retryFailed();layer.dispose();
    while(layer.pending.size)await new Promise(r=>setTimeout(r,10));
    assert.equal(layer.group.children.length,0);assert.equal(layer.sources.size,0);
  } finally {globalThis.fetch=goodFetch;console.warn=warn;layer.dispose();}
});
