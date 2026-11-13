import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {buildSync} from '../webapp/node_modules/esbuild/lib/main.js';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {STARTER_WEAPON,WEAPON_BY_ID} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';

// Execute the real loader, batching, calibration and cache. Only transport and
// image decoding are controlled; the actual checked-in weapon GLBs are parsed.
const directory=mkdtempSync(fileURLToPath(new URL('../webapp/.held-loading-test-',import.meta.url)));
const output=directory+'/runtime.mjs';
buildSync({entryPoints:[fileURLToPath(new URL('../webapp/src/games/tiranastreets/street-career/FirstPersonBody.ts',import.meta.url))],outfile:output,bundle:true,platform:'node',format:'esm',external:['three','three/*'],logLevel:'silent'});
const {FirstPersonBody}=await import(pathToFileURL(output));
const cleanup=()=>rmSync(directory,{recursive:true,force:true});
test.after(cleanup);process.on('exit',cleanup);
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const responseFor=url=>{
 const bytes=readFileSync(new URL('../webapp/public'+new URL(url).pathname,import.meta.url));
 return new Response(bytes,{headers:{'content-type':'model/gltf-binary'}});
};
function fixture(t,fetcher){
 const originalWindow=globalThis.window;globalThis.window={location:{href:'https://tirana.test/'}};
 t.after(()=>{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;});
 const parse=GLTFLoader.prototype.parseAsync;
 t.mock.method(GLTFLoader.prototype,'parseAsync',function(...args){this.register(()=>({name:'HEADLESS_TEXTURES',loadTexture:async()=>new T.Texture()}));return parse.apply(this,args);});
 t.mock.method(globalThis,'fetch',fetcher);
 const rig=new FirstPersonBody(new T.Scene());t.after(()=>rig.dispose());return rig;
}
const drop=(id,weapon)=>({id,weapon,x:0,y:.2,z:0});

test('optional loot occupies one transfer slot and selected weapon proceeds while it is pending',{timeout:10000},async t=>{
 const pending=deferred(),calls=[];
 const rig=fixture(t,async(url,options)=>{calls.push({url:String(url),options});if(String(url).includes('/uzi.glb'))await pending.promise;return responseFor(url);});
 t.after(async()=>{pending.resolve();await Promise.allSettled([...rig.requests.values()]);});
 rig.syncLoot([drop('first','uziSprayAttack'),drop('second','glockSidearmAttack')],new Set());
 assert.equal(calls.length,1,'two optional drops cannot occupy both transfer slots');
 assert.match(calls[0].url,/\/uzi\.glb$/);
 await rig.prepare(STARTER_WEAPON);
 assert.equal(calls.length,2,'selected AK starts immediately alongside the pending optional transfer');
 assert.match(calls[1].url,/\/ak47\.glb$/);
 assert.ok(rig.cloneWeapon(STARTER_WEAPON));assert.equal(rig.cloneWeapon('uziSprayAttack'),undefined);
 assert.equal(rig.errors.length,0);
 pending.resolve();await Promise.allSettled([...rig.requests.values()]);
 assert.ok(rig.cloneWeapon('uziSprayAttack'));
});

test('duplicate selected readiness requests share one download and resolve only after real GLB preparation',{timeout:10000},async t=>{
 const pending=deferred();let calls=0,finished=0;
 const rig=fixture(t,async url=>{calls++;await pending.promise;return responseFor(url);});
 t.after(async()=>{pending.resolve();await Promise.allSettled([...rig.requests.values()]);});
 const first=rig.prepare(STARTER_WEAPON).then(()=>finished++),second=rig.prepare(STARTER_WEAPON).then(()=>finished++);
 await Promise.resolve();assert.equal(calls,1);assert.equal(finished,0);assert.equal(rig.cloneWeapon(STARTER_WEAPON),undefined);
 pending.resolve();await Promise.all([first,second]);
 assert.equal(finished,2);assert.equal(calls,1);
 const clone=rig.cloneWeapon(STARTER_WEAPON);assert.ok(clone);assert.ok(!new T.Box3().setFromObject(clone).isEmpty());
 await rig.prepare(STARTER_WEAPON);assert.equal(calls,1,'cached selected weapon avoids another download');
});

test('a skipped optional request is immediately promoted when that same weapon is selected',{timeout:10000},async t=>{
 const pending=deferred(),selectedTransfer=deferred(),calls=[];
 const rig=fixture(t,async url=>{calls.push(String(url));await (String(url).includes('/uzi.glb')?pending.promise:selectedTransfer.promise);return responseFor(url);});
 t.after(async()=>{pending.resolve();selectedTransfer.resolve();await Promise.allSettled([...rig.requests.values()]);});
 const selected='glockSidearmAttack';
 rig.syncLoot([drop('first','uziSprayAttack'),drop('selected-drop',selected)],new Set());
 // Deliberately no microtask gap: selection can happen in the same frame as
 // optional queue admission, and readiness must never resolve without a model.
 const ready=rig.prepare(selected);await Promise.resolve();await Promise.resolve();
 assert.equal(calls.length,2);assert.ok(rig.requests.has(selected),'a skipped attempt cannot erase the new active request');
 let duplicateFinished=false;const duplicate=rig.prepare(selected).then(()=>{duplicateFinished=true;});
 await Promise.resolve();await Promise.resolve();assert.equal(duplicateFinished,false,'later readiness still awaits the promoted transfer');assert.equal(calls.length,2);
 selectedTransfer.resolve();await Promise.all([ready,duplicate]);
 assert.ok(rig.cloneWeapon(selected));assert.equal(rig.cloneWeapon('uziSprayAttack'),undefined);assert.equal(rig.requests.has(selected),false,'completed request cleans up its own map entry');
 pending.resolve();await Promise.allSettled([...rig.requests.values()]);
});

test('503 failures back off, coalesce errors, and restore the selected original model after recovery',{timeout:10000},async t=>{
 let time=100000,calls=0;const caches=[];
 t.mock.method(Date,'now',()=>time);t.mock.method(console,'warn',()=>{});
 const rig=fixture(t,async(url,options)=>{calls++;caches.push(options.cache);return calls<3?new Response('',{status:503}):responseFor(url);});
 await rig.prepare(STARTER_WEAPON);
 assert.equal(calls,1);assert.equal(rig.errors.length,1);assert.match(rig.errors[0],/HTTP 503/);assert.equal(rig.cloneWeapon(STARTER_WEAPON),undefined);
 for(let i=0;i<5;i++)await rig.prepare(STARTER_WEAPON);
 assert.equal(calls,1,'render retries cannot hammer the failed endpoint during cooldown');
 time+=2001;await rig.prepare(STARTER_WEAPON);
 assert.equal(calls,2);assert.equal(rig.errors.length,1,'a repeated outage reports one message for this weapon');
 time+=3999;await rig.prepare(STARTER_WEAPON);assert.equal(calls,2,'second failure uses a longer cooldown');
 time+=2;await Promise.all([rig.prepare(STARTER_WEAPON),rig.prepare(STARTER_WEAPON)]);
 assert.equal(calls,3);assert.deepEqual(caches,['default','reload','reload']);
 assert.equal(rig.errors.length,0);assert.equal(rig.failed.has(STARTER_WEAPON),false);assert.equal(rig.retryAt.has(STARTER_WEAPON),false);assert.equal(rig.attempts.has(STARTER_WEAPON),false);
 const model=rig.cloneWeapon(STARTER_WEAPON);assert.ok(model);assert.ok(!new T.Box3().setFromObject(model).isEmpty(),'recovery restores a calibrated real weapon, not only a success flag');
});

test('network timeout ends when bytes arrive, so a long decode cannot abort a successful transfer',{timeout:10000},async t=>{
 const decoding=deferred(),release=deferred();let signal;
 const rig=fixture(t,async(url,options)=>{signal=options.signal;return responseFor(url);});
 const parse=GLTFLoader.prototype.parseAsync;
 t.mock.method(GLTFLoader.prototype,'parseAsync',async function(...args){decoding.resolve();await release.promise;return parse.apply(this,args);});
 t.mock.timers.enable({apis:['setTimeout']});
 t.after(async()=>{release.resolve();await Promise.allSettled([...rig.requests.values()]);});
 const ready=rig.prepare(STARTER_WEAPON);await decoding.promise;
 t.mock.timers.tick(45001);assert.equal(signal.aborted,false,'the download timer must not cover model decoding');
 release.resolve();await ready;assert.ok(rig.cloneWeapon(STARTER_WEAPON));assert.equal(rig.errors.length,0);
});

test('loot synchronization attaches at most two new copies per frame and respects claimed drops',{timeout:10000},async t=>{
 let calls=0;const rig=fixture(t,async url=>{calls++;return responseFor(url);});
 await rig.prepare(STARTER_WEAPON);assert.equal(calls,1);
 const drops=Array.from({length:7},(_,i)=>drop(`drop-${i}`,STARTER_WEAPON));
 rig.syncLoot(drops,new Set());assert.equal(rig.drops.size,2);
 rig.syncLoot(drops,new Set());assert.equal(rig.drops.size,4);
 rig.syncLoot(drops,new Set(['drop-0']));assert.equal(rig.drops.size,5);assert.equal(rig.drops.has('drop-0'),false);
 assert.equal(calls,1,'new loot clones share the prepared model and never refetch');
 const copies=[...rig.drops.values()];assert.notEqual(copies[0],copies[1]);
 assert.equal(WEAPON_BY_ID.has(STARTER_WEAPON),true);
});
